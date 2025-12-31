"use client";

import { useEffect, useRef } from "react";

interface MessengerChatProps {
  pageId: string;
}

export function MessengerChat({ pageId }: MessengerChatProps) {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Set Chat Plugin attributes
    if (chatRef.current) {
      chatRef.current.setAttribute("page_id", pageId);
      chatRef.current.setAttribute("attribution", "biz_inbox");
    }

    // 2. Initialize FB SDK if not present
    // @ts-ignore
    window.fbAsyncInit = function() {
      // @ts-ignore
      FB.init({
        xfbml            : true,
        version          : 'v18.0'
      });
    };

    // 3. Load SDK Script
    if (document.getElementById('facebook-jssdk')) {
       // Re-parse if script already exists to update plugin
       // @ts-ignore
       if (window.FB) window.FB.XFBML.parse();
       return;
    }

    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s) as HTMLScriptElement; 
      js.id = id;
      js.src = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
      fjs.parentNode?.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
    
  }, [pageId]);

  return (
    <>
      <div id="fb-root"></div>
      <div id="fb-customer-chat" className="fb-customerchat" ref={chatRef}></div>
    </>
  );
}
