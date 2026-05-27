/**
 * WebRTC call management using Firebase Realtime Database for signaling.
 * Supports: caller / callee roles, ICE buffering, screen-share track swap.
 */

import { rtdb } from "./firebase";
import { ref, push, set, onValue, update } from "firebase/database";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

export class WebRTCCall {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private readonly callId: string;
  private readonly role: "caller" | "callee";
  private unsubscribers: (() => void)[] = [];
  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private seenCandidateKeys = new Set<string>();

  /* Callbacks */
  onRemoteStream?: (stream: MediaStream) => void;
  onCallEnded?: () => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;

  constructor(callId: string, role: "caller" | "callee") {
    this.callId = callId;
    this.role = role;
  }

  /** Start local media capture and begin WebRTC signaling */
  async initialize(videoEnabled = true, audioEnabled = true): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: videoEnabled
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
        : false,
      audio: audioEnabled,
    });

    this.pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local tracks
    this.localStream.getTracks().forEach((track) => {
      this.pc!.addTrack(track, this.localStream!);
    });

    // Remote stream
    this.pc.ontrack = (event) => {
      if (this.onRemoteStream && event.streams[0]) {
        this.onRemoteStream(event.streams[0]);
      }
    };

    // ICE candidates → push to Firebase
    this.pc.onicecandidate = async ({ candidate }) => {
      if (candidate) {
        const candidatesRef = ref(
          rtdb,
          `callRequests/${this.callId}/iceCandidates/${this.role}`
        );
        await push(candidatesRef, candidate.toJSON());
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.onConnectionStateChange?.(this.pc.connectionState);
      }
    };

    // Role-specific signaling flow
    if (this.role === "caller") {
      await this._createAndSendOffer();
    } else {
      await this._readOfferAndSendAnswer();
    }

    this._listenForRemoteICE();
    this._listenForCallEnd();

    return this.localStream;
  }

  /* ─── Caller: create SDP offer ─── */
  private async _createAndSendOffer() {
    const offer = await this.pc!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc!.setLocalDescription(offer);

    await set(ref(rtdb, `callRequests/${this.callId}/offer`), {
      type: offer.type,
      sdp: offer.sdp,
    });

    // Wait for callee's answer
    const answerUnsub = onValue(
      ref(rtdb, `callRequests/${this.callId}/answer`),
      async (snap) => {
        if (!snap.exists()) return;
        if (this.pc?.signalingState !== "have-local-offer") return;
        try {
          await this.pc!.setRemoteDescription(
            new RTCSessionDescription(snap.val())
          );
          await this._flushBufferedCandidates();
        } catch (e) {
          console.error("Error setting remote description (answer):", e);
        }
      }
    );
    this.unsubscribers.push(answerUnsub);
  }

  /* ─── Callee: read offer, send answer ─── */
  private async _readOfferAndSendAnswer() {
    // Wait until offer arrives in Firebase
    const offer = await new Promise<RTCSessionDescriptionInit>((resolve) => {
      const unsub = onValue(
        ref(rtdb, `callRequests/${this.callId}/offer`),
        (snap) => {
          if (snap.exists()) {
            unsub();
            resolve(snap.val() as RTCSessionDescriptionInit);
          }
        }
      );
    });

    await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));
    await this._flushBufferedCandidates();

    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);

    await set(ref(rtdb, `callRequests/${this.callId}/answer`), {
      type: answer.type,
      sdp: answer.sdp,
    });
  }

  /* ─── Listen for remote ICE candidates ─── */
  private _listenForRemoteICE() {
    const remoteRole = this.role === "caller" ? "callee" : "caller";
    const iceRef = ref(
      rtdb,
      `callRequests/${this.callId}/iceCandidates/${remoteRole}`
    );

    const unsub = onValue(iceRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val() as Record<string, RTCIceCandidateInit>;
      Object.entries(data).forEach(([key, candidateData]) => {
        if (this.seenCandidateKeys.has(key)) return;
        this.seenCandidateKeys.add(key);
        if (this.pc?.remoteDescription) {
          this.pc
            .addIceCandidate(new RTCIceCandidate(candidateData))
            .catch(console.error);
        } else {
          this.iceCandidateBuffer.push(candidateData);
        }
      });
    });
    this.unsubscribers.push(unsub);
  }

  /** Apply any ICE candidates received before remoteDescription was ready */
  private async _flushBufferedCandidates() {
    const toFlush = [...this.iceCandidateBuffer];
    this.iceCandidateBuffer = [];
    for (const c of toFlush) {
      await this.pc
        ?.addIceCandidate(new RTCIceCandidate(c))
        .catch(console.error);
    }
  }

  /* ─── Listen for remote party ending the call ─── */
  private _listenForCallEnd() {
    const unsub = onValue(
      ref(rtdb, `callRequests/${this.callId}/status`),
      (snap) => {
        if (snap.val() === "ended") {
          this.onCallEnded?.();
        }
      }
    );
    this.unsubscribers.push(unsub);
  }

  /* ─── Screen share — swaps video track in the peer connection ─── */
  async shareScreen(): Promise<MediaStream | null> {
    try {
      const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = this.pc
        ?.getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(screenTrack);

      // Revert to camera when screen share stops
      screenTrack.onended = () => {
        const camTrack = this.localStream?.getVideoTracks()[0];
        if (camTrack && sender) sender.replaceTrack(camTrack).catch(console.error);
      };

      return screenStream;
    } catch {
      return null;
    }
  }

  /* ─── Controls ─── */
  toggleAudio(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  toggleVideo(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  /** Signal the other party and clean up */
  async endCall() {
    await update(ref(rtdb, `callRequests/${this.callId}`), {
      status: "ended",
      endedAt: new Date().toISOString(),
    }).catch(console.error);
    this.cleanup();
  }

  /** Release all resources without touching Firebase */
  cleanup() {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
    this.localStream = null;
    this.iceCandidateBuffer = [];
    this.seenCandidateKeys.clear();
  }
}
