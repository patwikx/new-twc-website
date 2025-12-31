"use client";

import { useState } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MockMessengerChatProps {
  propertyName: string;
  onClose: () => void;
}

export function MockMessengerChat({ propertyName, onClose }: MockMessengerChatProps) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: `Hi! Welcome to ${propertyName}. How can we help you today?` }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, propertyName }),
      });

      const data = await res.json();
      
      setMessages(prev => [...prev, { role: "assistant", text: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", text: "Sorry, I'm having trouble connecting to the server." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 w-80 h-96 bg-white rounded-xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden z-40 animate-in slide-in-from-bottom-5 fade-in duration-300 font-sans">
       {/* Header */}
       <div className="bg-[#0084FF] p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
             <MessageCircle className="h-5 w-5 fill-white text-white" />
             <span className="font-semibold">{propertyName}</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors">
            <X className="h-5 w-5" />
          </button>
       </div>
       
       {/* Messages */}
       <div className="flex-1 bg-neutral-100 p-4 space-y-3 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`max-w-[80%] p-3 text-sm rounded-2xl ${
                 m.role === 'user' 
                   ? 'bg-[#0084FF] text-white rounded-br-none' 
                   : 'bg-white text-black shadow-sm rounded-bl-none'
               }`}>
                 {m.text}
               </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex justify-start">
               <div className="bg-white text-neutral-500 p-3 text-sm rounded-2xl shadow-sm rounded-bl-none italic animate-pulse">
                 Typing...
               </div>
             </div>
          )}
       </div>

       {/* Input */}
       <div className="p-3 bg-white border-t flex gap-2">
          <Input 
            value={input} 
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..." 
            className="flex-1 rounded-full bg-neutral-100 border-none focus-visible:ring-1 focus-visible:ring-[#0084FF] text-black"
          />
          <Button size="icon" onClick={handleSend} className="rounded-full h-10 w-10 bg-[#0084FF] hover:bg-[#0073e6]">
             <Send className="h-4 w-4" />
          </Button>
       </div>
    </div>
  );
}
