"use strict";
(() => {
 const $=id=>document.getElementById(id);
 let adminKey="",tenant="",records=[],chosen=null;
 const feedback=(msg,error=false)=>{const p=$("phone-feedback");p.textContent=msg;p.className=error?"info-paragraph amber":"info-paragraph";};
 const req=async(method,route,payload,extra={})=>{
   const bearer=window.CodestraPhoneOIDC?.accessToken?.()||null;
   if((!adminKey&&!bearer)||!tenant)throw Error("Sign in with Keycloak or use the staging administrator key and tenant first.");
   const headers={...(bearer?{authorization:"Bearer "+bearer}:{"x-phone-admin-token":adminKey}),
      "x-tenant-id":tenant,accept:"application/json",...extra};
   if(payload!==undefined)headers["content-type"]="application/json";
   const res=await fetch("/api/phone-accounts"+route,{method,headers,credentials:"same-origin",cache:"no-store",
     ...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(10000)});
   let json;try{json=await res.json();}catch{json={error:{code:"invalid_server_response"}};}
   if(!res.ok){
     const code=json?.error?.code||"request_failed";
     const human={
       unauthorized:"Administrator key rejected.",phone_admin_not_configured:"Administrator key is not configured.",
       phone_enrollment_disabled:"Provider enrollment is intentionally disabled in staging.",
       provider_enrollment_disabled:"Provider enrollment is intentionally disabled in staging.",
       adapter_auth_not_configured:"Provider adapter credentials are not configured.",
       stale_version:"This account has changed. Refresh and try again.",
       phone_already_registered:"This phone or instance is already registered.",
       account_not_found:"Account no longer exists."
     };
     throw new Error(human[code]||"Phone action blocked: "+code+" (HTTP "+res.status+")");
   }
   return json;
 };
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;};
 const options={
   meta:[["request-code","Request SMS / voice code"],["verify-code","Verify phone ownership"],["register","Register with Meta PIN"]],
   evolution:[["create-instance","Create Evolution instance"],["qr","Get QR pairing image"],["status","Refresh connection status"]]
 };
 function showFields(){
   const meta=$("phone-provider").value==="meta";
   $("phone-meta-fields").hidden=!meta;$("phone-evolution-fields").hidden=meta;
   $("phone-number").required=meta;$("phone-waba").required=meta;$("phone-meta-id").required=meta;
   $("phone-instance").required=!meta;
 }
 function setSelected(item){
   chosen=item;
   $("phone-selection").textContent=item?item.label+" · "+item.provider.toUpperCase()+" · "+(item.number_masked||"No phone verified")+" · "+item.state:"No account selected.";
   const action=$("phone-action");action.replaceChildren();
   if(!item){action.disabled=true;action.append(el("option","Select account first"));return;}
   for(const [val,label] of options[item.provider]||[]){
     const opt=el("option",label);opt.value=val;action.append(opt);
   }
   action.disabled=false;
   $("phone-qr-container").hidden=true;
   $("phone-qr-image").removeAttribute("src");
 }
 function render(){
   const list=$("phone-accounts-list");list.replaceChildren();
   if(!records.length){list.append(el("p","No phone accounts registered for this tenant. Add a staging draft to begin.","privacy-note"));setSelected(null);return;}
   for(const item of records){
     const card=el("div",undefined,"phone-item");card.setAttribute("role","listitem");
     const meta=el("div",undefined,"phone-item-info");
     meta.append(el("strong",item.label),el("small",(item.number_masked||"Number pending")+" · "+item.provider.toUpperCase()+" · "+item.state+" · version "+item.version));
     const control=el("div",undefined,"phone-item-controls");
     const select=el("button","Manage","btn");select.type="button";select.addEventListener("click",()=>setSelected(item));control.append(select);
     if(item.state!=="disabled"){
       const disable=el("button","Disable","btn");disable.type="button";
       disable.addEventListener("click",async()=>{
         if(!confirm("Disable this phone-account draft? This does not delete your WhatsApp account."))return;
         try{await req("PATCH","/"+encodeURIComponent(item.id),{expected_version:item.version,patch:{disabled:true}});
           await load();feedback("Phone account disabled. No provider disconnect was performed.");}
         catch(e){feedback(e.message,true);}
       });control.append(disable);
     }
     card.append(meta,control);list.append(card);
   }
   if(chosen){const refreshed=records.find(x=>x.id===chosen.id);setSelected(refreshed||null);}
 }
 async function load(){
   const result=await req("GET","");
   records=Array.isArray(result.items)?result.items:[];
   render();feedback(records.length+" account(s) loaded for "+tenant+". Provider enrollment effects remain locked.");
 }
 async function authorize(event){
   event.preventDefault();
   adminKey=$("phone-token").value.trim();tenant=$("phone-tenant").value.trim();
   if(adminKey.length<24||!/^[-_A-Za-z0-9]{2,64}$/.test(tenant)){feedback("Enter a valid tenant and private admin key.",true);return;}
   try{await load();$("phone-token").value="";}catch(e){adminKey="";$("phone-token").value="";feedback(e.message,true);}
 }
 async function create(event){
   event.preventDefault();
   if(!adminKey&&!window.CodestraPhoneOIDC?.accessToken?.()){feedback("Authenticate before creating phone accounts.",true);return;}
   const provider=$("phone-provider").value;
   const data={
     provider,tenant_id:tenant,label:$("phone-label").value.trim(),
     number:$("phone-number").value.trim()||null,
     campaign_id:$("phone-campaign").value.trim()||null,
     ...(provider==="meta"?{waba_id:$("phone-waba").value.trim(),phone_number_id:$("phone-meta-id").value.trim()}:{instance_name:$("phone-instance").value.trim()})
   };
   try{
     const entry=await req("POST","",data);
     event.currentTarget.reset();showFields();
     await load();setSelected(records.find(x=>x.id===entry.id)||null);
     feedback("Staging draft saved. No SMS, QR, or external provider operation occurred.");
   }catch(e){feedback(e.message,true);}
 }
 async function action(event){
   event.preventDefault();
   if(!chosen){feedback("Choose an account first.",true);return;}
   const mode=$("phone-action").value;
   const input=chosen.provider==="meta"
     ?{method:$("phone-method").value,language:"en_US",code:$("phone-code").value.trim(),pin:$("phone-pin").value.trim()}
     :{};
   try {
     const result=await req("POST","/"+encodeURIComponent(chosen.id)+"/actions/"+mode,{expected_version:chosen.version,input},{"idempotency-key":crypto.randomUUID()});
     $("phone-code").value="";$("phone-pin").value="";
     if(result.result?.qr_image && /^data:image\/png;base64,[A-Za-z0-9+/=]{100,400000}$/.test(result.result.qr_image)){
       $("phone-qr-image").src=result.result.qr_image;$("phone-qr-container").hidden=false;
     }
     await load();feedback(mode+" completed for "+chosen.label+". Sending remains disabled.");
   }catch(e){$("phone-code").value="";$("phone-pin").value="";feedback(e.message,true);}
 }
 async function initializeIdentity(){
   try {
     const auth=await window.CodestraPhoneOIDC.initialize();
     const isOIDC=auth.mode==="oidc";
     const form=$("phone-oidc-access-form");form.hidden=!isOIDC;
     if(isOIDC&&auth.resumed){
       tenant=$("phone-oidc-tenant").value.trim();
       await load();
     }
   }catch(e){feedback("Identity setup failed: "+e.message,true);}
 }
 $("phone-oidc-login").addEventListener("click",async()=>{
   try{await window.CodestraPhoneOIDC.begin();}
   catch(e){feedback("Keycloak login failed: "+e.message,true);}
 });
 $("phone-oidc-access-form").addEventListener("submit",async event=>{
   event.preventDefault();tenant=$("phone-oidc-tenant").value.trim();
   if(!window.CodestraPhoneOIDC.accessToken()){feedback("Sign in with Keycloak first.",true);return;}
   try{await load();}catch(e){feedback(e.message,true);}
 });
 initializeIdentity();
 $("phone-provider").addEventListener("change",showFields);
 $("phone-access-form").addEventListener("submit",authorize);
 $("phone-create-form").addEventListener("submit",create);
 $("phone-action-form").addEventListener("submit",action);
 $("phone-refresh").addEventListener("click",async()=>{try{await load();}catch(e){feedback(e.message,true);}});
 showFields();
})();
