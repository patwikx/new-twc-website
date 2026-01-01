"use client";

import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembershipCard } from "@/components/account/membership-card";
import { SettingsForm } from "@/components/auth/settings-form";
import { CreditCard, History, Settings, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PreferencesForm } from "@/components/account/preferences-form";
import Link from "next/link";

export const AccountLayout = () => {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="w-full max-w-5xl mx-auto p-6 md:p-8 pt-32 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-serif text-white">My Account</h1>
          <p className="text-neutral-400">Welcome back, {user?.name?.split(" ")[0] || "Guest"}.</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full space-y-8">
        <TabsList className="w-full justify-start bg-transparent p-0 border-b border-white/10 h-auto rounded-none space-x-8">
          <TabsTrigger 
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-500 px-0 py-3 text-neutral-400 hover:text-white transition-colors"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="profile"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-500 px-0 py-3 text-neutral-400 hover:text-white transition-colors"
          >
            Profile & Security
          </TabsTrigger>
          <TabsTrigger 
            value="preferences"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-500 px-0 py-3 text-neutral-400 hover:text-white transition-colors"
          >
            Preferences
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <section>
                <h2 className="text-xl font-serif text-white mb-4">Membership Status</h2>
                <MembershipCard 
                  membership={null}
                  userName={user?.name}
                  oderId={user?.id}
                />
              </section>
              
              <section>
                 <h2 className="text-xl font-serif text-white mb-4">Recent Actvity</h2>
                 <Card className="bg-neutral-900 border-white/10 rounded-none">
                    <CardContent className="p-8 text-center text-neutral-500">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No recent activity found.</p>
                    </CardContent>
                 </Card>
              </section>
            </div>

            <div className="space-y-6">
              <Card className="bg-neutral-900 border-white/10 rounded-none">
                <CardHeader>
                  <CardTitle className="text-sm font-medium tracking-widest uppercase text-neutral-400">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                   <button className="flex items-center gap-3 p-3 w-full text-left bg-white/5 hover:bg-white/10 transition text-white text-sm">
                      <CreditCard className="h-4 w-4" />
                      Manage Payment Methods
                   </button>
                   <Link href="/bookings" className="flex items-center gap-3 p-3 w-full text-left bg-white/5 hover:bg-white/10 transition text-white text-sm">
                      <History className="h-4 w-4" />
                      View Booking History
                   </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="max-w-2xl">
             <SettingsForm />
          </div>
        </TabsContent>



        {/* Preferences Tab */}
        <TabsContent value="preferences">
           <PreferencesForm />
        </TabsContent>
        
      </Tabs>
    </div>
  );
};
