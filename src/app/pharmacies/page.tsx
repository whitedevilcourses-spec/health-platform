"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  Search, MapPin, Star, Clock, Heart, ShieldCheck, 
  X, CheckCircle2, ShoppingBag, Truck, Check, Sparkles
} from "lucide-react";

export default function PharmaciesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [medicineFilter, setMedicineFilter] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);

  // Cart / Order states
  const [orderingPharmacy, setOrderingPharmacy] = useState<any | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const pharmacies = [
    { id: "p1", name: "Metro Health 24/7 Pharmacy", address: "Medical Center Pkwy, Hyderabad", distance: "1.4m", rating: 4.8, open: true, delivery: true, inventory: ["Aspirin 75mg", "Paracetamol 500mg", "Amoxicillin 250mg", "Lipitor 10mg"] },
    { id: "p2", name: "St. Jude Community Pharmacy", address: "450 Memorial Ave, Nellore", distance: "2.8m", rating: 4.6, open: true, delivery: true, inventory: ["Aspirin 75mg", "Paracetamol 500mg", "Ibuprofen 400mg", "Metformin 500mg"] },
    { id: "p3", name: "Apollo Hope Wellness Druggist", address: "Banjara Hills, Hyderabad", distance: "3.1m", rating: 4.9, open: true, delivery: true, inventory: ["Lipitor 10mg", "Metformin 500mg", "Zoloft 50mg", "Amoxicillin 250mg"] },
    { id: "p4", name: "Care Family Med Store", address: "80 Main Road, Nellore", distance: "4.5m", rating: 4.3, open: false, delivery: false, inventory: ["Paracetamol 500mg", "Ibuprofen 400mg"] },
  ];

  const handleOrderInit = (pharmacy: any, med: string) => {
    setOrderingPharmacy(pharmacy);
    setSelectedMedicine(med);
    setOrderSuccess(false);
  };

  const handleConfirmOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderSuccess(true);
  };

  const filteredPharmacies = pharmacies.filter((ph) => {
    const matchesSearch = ph.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ph.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMed = !medicineFilter || ph.inventory.some(m => m.toLowerCase().includes(medicineFilter.toLowerCase()));
    const matchesOpen = !openOnly || ph.open;
    const matchesDelivery = !deliveryOnly || ph.delivery;
    return matchesSearch && matchesMed && matchesOpen && matchesDelivery;
  });

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 md:px-6 relative overflow-hidden">
      {/* Visual background lights */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto relative z-10 space-y-10">
        
        {/* Page Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            <ShoppingBag className="w-3.5 h-3.5 mr-1" />
            Pharmacy Finder
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            Sourcing & Delivery Locator
          </h1>
          <p className="text-sm md:text-base text-muted-foreground font-semibold">
            Locate 24/7 pharmacies, browse real-time inventory levels for essential medicines, and dispatch home delivery under 30 minutes.
          </p>
        </div>

        {/* Filter Card */}
        <Card className="border border-border/50 bg-card/65 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            
            {/* Search Input */}
            <div className="space-y-2">
              <Label className="font-bold text-sm tracking-tight text-foreground">Pharmacy Name or Location</Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="e.g. Metro Health, Nellore, Hyderabad..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background/50 border-border/80 pl-10 focus:border-primary h-11 rounded-xl"
                />
              </div>
            </div>

            {/* Medicine Inventory Search */}
            <div className="space-y-2">
              <Label className="font-bold text-sm tracking-tight text-foreground">Search Essential Medicine</Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="e.g. Aspirin, Paracetamol..." 
                  value={medicineFilter}
                  onChange={(e) => setMedicineFilter(e.target.value)}
                  className="bg-background/50 border-border/80 pl-10 focus:border-primary h-11 rounded-xl"
                />
              </div>
            </div>

            {/* Open status */}
            <div className="flex items-center space-x-2 pb-3 select-none">
              <input
                type="checkbox"
                id="openCheck"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
                className="h-4 w-4 bg-background border-border text-primary focus:ring-primary/15 rounded"
              />
              <label htmlFor="openCheck" className="text-xs font-bold text-muted-foreground cursor-pointer">Open 24/7 Only</label>
            </div>

            {/* Delivery status */}
            <div className="flex items-center space-x-2 pb-3 select-none">
              <input
                type="checkbox"
                id="deliveryCheck"
                checked={deliveryOnly}
                onChange={(e) => setDeliveryOnly(e.target.checked)}
                className="h-4 w-4 bg-background border-border text-primary focus:ring-primary/15 rounded"
              />
              <label htmlFor="deliveryCheck" className="text-xs font-bold text-muted-foreground cursor-pointer">Home Delivery Available</label>
            </div>

          </div>
        </Card>

        {/* Pharmacy Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredPharmacies.map((pharmacy) => (
            <motion.div
              key={pharmacy.id}
              whileHover={{ y: -2 }}
              className="group flex flex-col justify-between bg-card/45 hover:bg-card/75 border border-border/50 rounded-3xl shadow-lg p-6 sm:p-8 overflow-hidden transition-all duration-300 relative"
            >
              <div className="space-y-6">
                
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-foreground tracking-tight leading-tight">{pharmacy.name}</h3>
                      {pharmacy.open ? (
                        <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 shadow-sm">
                          Open 24/7
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5">
                          Closed
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 font-semibold truncate">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      {pharmacy.address} ({pharmacy.distance})
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg shrink-0">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-[11px] font-bold text-foreground">{pharmacy.rating}</span>
                  </div>
                </div>

                {/* Inventory list */}
                <div className="space-y-2.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Verified Medicine Inventory</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pharmacy.inventory.map((med, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "flex items-center justify-between p-2 rounded-xl border text-[11px] font-semibold transition-all duration-200",
                          medicineFilter && med.toLowerCase().includes(medicineFilter.toLowerCase())
                            ? "bg-primary/10 border-primary/20 text-primary"
                            : "bg-background/50 border-border/60 text-muted-foreground"
                        )}
                      >
                        <span className="truncate">{med}</span>
                        {pharmacy.open && (
                          <button
                            onClick={() => handleOrderInit(pharmacy, med)}
                            className="bg-primary/10 hover:bg-primary/25 border border-primary/20 hover:border-primary/30 text-primary text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0"
                          >
                            Order
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Pharmacy details row */}
              <div className="border-t border-border/40 pt-4 mt-6 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Available: {pharmacy.open ? "Immediate dispatch" : "Reopens 09:00 AM"}</span>
                </div>
                {pharmacy.delivery && (
                  <Badge className="bg-primary/5 text-primary border border-primary/10 font-bold text-[9px] uppercase tracking-wider rounded-lg px-2.5 py-0.5 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-primary animate-bounce" /> Home Delivery
                  </Badge>
                )}
              </div>

            </motion.div>
          ))}
        </div>

      </div>

      {/* Modern Order Dispatch Drawer */}
      <AnimatePresence>
        {orderingPharmacy && selectedMedicine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-card border border-border/80 shadow-2xl rounded-3xl p-8 md:p-10 relative overflow-hidden"
            >
              
              {/* Close Button */}
              <button 
                onClick={() => { setOrderingPharmacy(null); setSelectedMedicine(null); }}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>

              {orderSuccess ? (
                /* Success ordering overlay */
                <div className="text-center space-y-6 py-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="inline-flex p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full mb-2">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Delivery Dispatched!</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Your order for **{selectedMedicine}** has been confirmed at **{orderingPharmacy.name}**. 
                    A delivery partner has been dispatched and is estimated to arrive in **20 minutes**.
                  </p>

                  <div className="pt-4 flex gap-4">
                    <Button className="w-full rounded-xl" onClick={() => { setOrderingPharmacy(null); setSelectedMedicine(null); }}>
                      Confirm & Exit
                    </Button>
                  </div>
                </div>
              ) : (
                /* Form fields */
                <form onSubmit={handleConfirmOrder} className="space-y-6">
                  <div className="space-y-2">
                    <Badge className="bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest">Order medicine</Badge>
                    <h3 className="text-2xl font-black text-foreground tracking-tight leading-tight">
                      Confirm Dispatch Details
                    </h3>
                    <p className="text-xs text-muted-foreground font-semibold">
                      Sourced from {orderingPharmacy.name}
                    </p>
                  </div>

                  <div className="bg-muted/40 border border-border/40 p-4 rounded-2xl space-y-1.5 text-xs font-semibold text-muted-foreground">
                    <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">Medicine:</span><span className="text-foreground">{selectedMedicine}</span></div>
                    <div className="flex justify-between"><span className="font-medium text-muted-foreground/60">Pharmacy Location:</span><span className="text-foreground truncate max-w-[200px]">{orderingPharmacy.address}</span></div>
                    <div className="flex justify-between border-t border-border/50 pt-2"><span className="font-bold text-foreground">Delivery Method:</span><span className="text-primary font-black uppercase flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-primary" /> Premium Triage Dispatch</span></div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pharmAddress" className="font-bold text-xs tracking-tight">Delivery Home Address</Label>
                      <Input 
                        id="pharmAddress"
                        required
                        placeholder="e.g. Apartment, Street, City"
                        className="bg-background border-border/80 h-10 px-3.5 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/40 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Estimated Cost</span>
                      <p className="font-black text-xl text-foreground">$12.50 <span className="text-[10px] font-semibold text-muted-foreground/80">(CODs or wallet)</span></p>
                    </div>

                    <Button 
                      type="submit" 
                      className="rounded-xl px-5 h-11 bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/10 flex items-center gap-2 shrink-0"
                    >
                      Confirm Dispatch
                      <Truck className="w-4 h-4 text-white" />
                    </Button>
                  </div>
                </form>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
