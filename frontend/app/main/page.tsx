"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Suspense, useEffect } from "react";

const airports = [
  { id: "BOS", name: "Boston Logan International Airport" },
  { id: "JFK", name: "John F. Kennedy International Airport" },
  { id: "EWR", name: "Newark Liberty International Airport" },
];

function MainPageContent() {
  const [arrivalDateTime, setArrivalDateTime] = useState("");
  const [airport, setAirport] = useState("");
  const [email, setEmail] = useState("");
  const router = useRouter();
  
  // Use useEffect to safely access the search params on the client side
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      `/results?email=${encodeURIComponent(email || "")}&arrivalDateTime=${encodeURIComponent(
        arrivalDateTime
      )}&airport=${encodeURIComponent(airport)}`
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <h1 className="text-3xl font-bold text-center">Flight Details</h1>
            <p className="text-center text-muted-foreground">
              Enter your arrival information to find other students
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="arrival">Arrival Date & Time</Label>
                <Input
                  id="arrival"
                  type="datetime-local"
                  value={arrivalDateTime}
                  onChange={(e) => setArrivalDateTime(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="airport">Airport</Label>
                <Select value={airport} onValueChange={setAirport} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your arrival airport" />
                  </SelectTrigger>
                  <SelectContent>
                    {airports.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        {apt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full">
                Find Travel Buddies
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function MainPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MainPageContent />
    </Suspense>
  );
}