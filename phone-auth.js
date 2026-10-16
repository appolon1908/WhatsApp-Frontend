"use strict";
(() => {
 let token=null,expiresAt=0,config=null;
 const transactionKey="codestra.phone.oidc.pkce";
 const allowedIssuer=/^https:\/\/[^/?#]+\/realms\/[A-Za-z0-9_-]+$/;
 const status=msg=>{const box=document.getElementById("phone-oidc-status");if(box)box.textContent=msg;};
 const random=()=>crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"");
 const base64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
 const redirectUri=()=>window.location.origin+window.location.pathname;
 function accessToken(){
   if(expiresAt<=Date.now()+15_000){token=null;return null;}
   return token;
 }
 function clear(){
   token=null;expiresAt=0;
   try{sessionStorage.removeItem(transactionKey);}catch{}
   status("Session cleared. No access token saved to disk.");
 }
 async function begin(){
   if(config?.mode!=="oidc" || !allowedIssuer.test(config.issuer)||!config.client_id)
     throw new Error("Keycloak is not configured for this environment");
   const state=random(),verifier=random();
   const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier));
   sessionStorage.setItem(transactionKey,JSON.stringify({state,verifier,issued:Date.now()}));
   const url=new URL(config.issuer+"/protocol/openid-connect/auth");
   const values={
     response_type:"code",client_id:config.client_id,redirect_uri:redirectUri(),
     scope:"openid",state,code_challenge:base64url(hash),code_challenge_method:"S256"
   };
   for(const [key,val]of Object.entries(values))url.searchParams.set(key,val);
   window.location.assign(url.toString());
 }
 async function consumeRedirect(){
   const url=new URL(window.location.href);
   const code=url.searchParams.get("code"),state=url.searchParams.get("state"),error=url.searchParams.get("error");
   if(!code&&!error)return false;
   url.searchParams.delete("code");url.searchParams.delete("state");
   url.searchParams.delete("session_state");url.searchParams.delete("error");
   url.searchParams.delete("error_description");
   window.history.replaceState(null,"",url.pathname+url.search+url.hash);
   if(error)throw new Error("Keycloak login was not completed");
   const raw=sessionStorage.getItem(transactionKey);sessionStorage.removeItem(transactionKey);
   let transaction;try{transaction=JSON.parse(raw);}catch{throw new Error("Invalid or expired login transaction");}
   if(!transaction||transaction.state!==state||!transaction.verifier||Date.now()-transaction.issued>300000)
     throw new Error("Invalid or expired login transaction");
   if(!config||config.mode!=="oidc")throw new Error("OIDC login not enabled");
   const body=new URLSearchParams({
     grant_type:"authorization_code",client_id:config.client_id,redirect_uri:redirectUri(),
     code,code_verifier:transaction.verifier
   });
   const response=await fetch(config.issuer+"/protocol/openid-connect/token",{
     method:"POST",mode:"cors",credentials:"omit",
     headers:{"content-type":"application/x-www-form-urlencoded"},
     body,redirect:"error",signal:AbortSignal.timeout(9000)
   });
   if(!response.ok)throw new Error("Keycloak token exchange rejected: "+response.status);
   const data=await response.json();
   if(typeof data.access_token!=="string" || data.access_token.length<40 ||
      !Number.isFinite(data.expires_in)||data.expires_in<30)
     throw new Error("Keycloak token response invalid");
   token=data.access_token;expiresAt=Date.now()+Math.min(data.expires_in,3600)*1000;
   status("Authenticated with Keycloak. Tenant and role are verified by the server.");
   return true;
 }
 async function initialize(){
   const response=await fetch("/api/phone-auth-config",{credentials:"same-origin",cache:"no-store",headers:{accept:"application/json"}});
   if(!response.ok)throw new Error("Phone identity configuration unavailable");
   config=await response.json();
   const oidc=config.mode==="oidc";
   const button=document.getElementById("phone-oidc-login");
   if(button)button.hidden=!oidc;
   const legacy=document.getElementById("phone-access-form");
   if(legacy){legacy.hidden=oidc;const inp=document.getElementById("phone-token");if(inp)inp.required=!oidc;}
   if(oidc && (!allowedIssuer.test(config.issuer)||!config.client_id))throw new Error("Invalid OIDC discovery configuration");
   const resumed=oidc?await consumeRedirect():false;
   if(!oidc)status("Staging authentication: separate administrator key required.");
   else if(!resumed)status("Keycloak sign-in required for managed phone accounts.");
   return {mode:config.mode,resumed};
 }
 window.CodestraPhoneOIDC=Object.freeze({initialize,begin,accessToken,clear});
})();
