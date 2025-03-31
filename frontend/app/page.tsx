"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plane, Users, Clock, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <div className="inline-block p-4 bg-primary/10 rounded-full">
              <Plane className="w-16 h-16 text-primary" />
            </div>
            <h1 className="text-5xl font-bold tracking-tight">Airport Buddy</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect with fellow UMass international students at the airport and make your arrival experience smoother and more enjoyable.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" onClick={() => router.push('/auth/signin')}>
                Sign In
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push('/auth/signup')}>
                Sign Up
              </Button>
            </div>
          </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <Users className="w-12 h-12 mx-auto text-primary" />
                <h3 className="text-xl font-semibold">Connect with Students</h3>
                <p className="text-muted-foreground">
                  Find and connect with other UMass students arriving at the same airport.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <Clock className="w-12 h-12 mx-auto text-primary" />
                <h3 className="text-xl font-semibold">Flexible Timing</h3>
                <p className="text-muted-foreground">
                  Set your waiting threshold and find students arriving within your timeframe.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <Shield className="w-12 h-12 mx-auto text-primary" />
                <h3 className="text-xl font-semibold">Secure Platform</h3>
                <p className="text-muted-foreground">
                  Exclusive to UMass students with verified .edu email addresses.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* How It Works Section */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center">How It Works</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center space-y-2">
                <div className="text-4xl font-bold text-primary">1</div>
                <h3 className="font-semibold">Sign Up</h3>
                <p className="text-sm text-muted-foreground">Create an account with your UMass email</p>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl font-bold text-primary">2</div>
                <h3 className="font-semibold">Enter Flight Details</h3>
                <p className="text-sm text-muted-foreground">Add your arrival time and airport</p>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl font-bold text-primary">3</div>
                <h3 className="font-semibold">Set Wait Time</h3>
                <p className="text-sm text-muted-foreground">Choose how long you can wait at the airport</p>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl font-bold text-primary">4</div>
                <h3 className="font-semibold">Connect</h3>
                <p className="text-sm text-muted-foreground">Find and meet other students</p>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </div>
    </main>
  );
}