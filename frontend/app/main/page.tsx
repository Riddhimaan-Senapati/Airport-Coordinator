"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

const airports = [
  { id: "BOS", name: "Boston Logan International Airport" },
  { id: "JFK", name: "John F. Kennedy International Airport" },
  { id: "EWR", name: "Newark Liberty International Airport" },
];

interface Traveler {
  email: string;
  arrivalDateTime: string;
  airport: string;
}

function MainPageContent() {
  const [arrivalDateTime, setArrivalDateTime] = useState("");
  const [airport, setAirport] = useState("");
  const [duration, setDuration] = useState("");
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<Traveler[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  // Initialize email from URL parameters
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith("umass.edu")) {
      setError("Please use your UMass email address.");
      return;
    }

    if (!arrivalDateTime || !airport) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const queryParams = new URLSearchParams({
        arrivalDateTime,
        duration: duration || '3600000',
        airport,
        email
      });

      const response = await fetch(`/api/filterData?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError("Failed to fetch results. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <h1 className="text-3xl font-bold text-center">Find Travel Buddies</h1>
            <p className="text-center text-muted-foreground">
              Connect with other UMass students flying to the same airport
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Form Section */}
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

              <div className="space-y-2">
                <Label htmlFor="duration">Maximum wait time (hours)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="24"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="1"
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding Matches...
                  </>
                ) : (
                  "Find Travel Buddies"
                )}
              </Button>
            </form>

            {/* Results Section */}
            {results.length > 0 && (
              <div className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Matching Travelers</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Arrival Time</TableHead>
                      <TableHead>Airport</TableHead>
                      <TableHead>Time Difference (min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.email}</TableCell>
                        <TableCell>
                          {new Date(result.arrivalDateTime).toLocaleString()}
                        </TableCell>
                        <TableCell>{result.airport}</TableCell>
                        <TableCell>
                          {Math.round(
                            Math.abs(
                              new Date(result.arrivalDateTime).getTime() -
                              new Date(arrivalDateTime).getTime()
                            ) / 60000
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function MainPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <MainPageContent />
    </Suspense>
  );
}