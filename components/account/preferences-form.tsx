"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const PreferencesForm = () => {
  return (
    <Card className="bg-neutral-900 border-white/10 rounded-none max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-serif text-white">Stay Preferences</CardTitle>
        <CardDescription className="text-neutral-400">
          Customize your room and service preferences for your next stay.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-widest text-neutral-500">Room Temperature</Label>
            <Select defaultValue="standard">
              <SelectTrigger className="w-full bg-neutral-950 border-white/10 text-white rounded-none h-12">
                <SelectValue placeholder="Select preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cool">Cool (18°C - 20°C)</SelectItem>
                <SelectItem value="standard">Standard (21°C - 23°C)</SelectItem>
                <SelectItem value="warm">Warm (24°C - 26°C)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-widest text-neutral-500">Pillow Type</Label>
            <Select defaultValue="feather">
              <SelectTrigger className="w-full bg-neutral-950 border-white/10 text-white rounded-none h-12">
                <SelectValue placeholder="Select preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feather">Duck Feather & Down</SelectItem>
                <SelectItem value="foam">Memory Foam</SelectItem>
                <SelectItem value="hypo">Hypoallergenic</SelectItem>
                <SelectItem value="firm">Extra Firm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
             <Label className="text-xs uppercase tracking-widest text-neutral-500">Dietary Restrictions</Label>
             <Textarea 
               placeholder="E.g., Gluten-free, Nut allergy, Vegan..." 
               className="bg-neutral-950 border-white/10 text-white rounded-none min-h-[100px] focus:border-orange-500/50"
             />
          </div>

          <div className="flex items-center justify-between rounded-none border border-white/10 p-4 bg-neutral-950">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-white">Turndown Service</Label>
              <p className="text-xs text-neutral-400">Receive evening room refreshment daily.</p>
            </div>
            <Switch defaultChecked className="data-[state=checked]:bg-orange-500" />
          </div>

          <div className="flex items-center justify-between rounded-none border border-white/10 p-4 bg-neutral-950">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-white">Newspaper</Label>
              <p className="text-xs text-neutral-400">Daily delivery of local or international press.</p>
            </div>
            <Switch className="data-[state=checked]:bg-orange-500" />
          </div>
        </div>

        <Button className="w-full h-12 rounded-none text-xs uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition-colors font-normal">
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
};
