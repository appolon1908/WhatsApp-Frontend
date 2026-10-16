"use strict";

// All state is ephemeral, browser-local, and contains no recipient or campaign form values.
const $ = (id) => document.getElementById(id);
const pages = Object.freeze(["overview","inbox","contacts","campaigns","templates","automations","phone-accounts","channels","activity","diagnostics","settings"]);
const labels = Object.freeze({overview:"Overview",inbox:"Inbox",contacts:"Contacts",campaigns:"Campaigns",templates:"Templates",automations:"Automations","phone-accounts":"Phone accounts",channels:"Channels",activity:"Activity",diagnostics:"Diagnostics",settings:"Settings"});
const endpoints = Object.freeze({app:"/api/healthz",appReady:"/api/readyz",adapter:"/adapter/healthz",adapterReady:"/adapter/readyz",middleware:"/api/integrations/middleware"});
const state = {samples:[],events:[],latest:null,updating:false};
const reasons = Object.freeze({
 suppressed:"Contact is on the suppression list", opted_out:"Contact has explicitly opted out",
 consent_not_opted_in:"Explicit opt-in consent has not been confirmed",
 recipient_missing:"Recipient identifier is required",
 owner_id_required:"Campaign owner is required",template_id_required:"Approved template ID is required",
 audience_count_invalid:"Audience count must be a positive whole number",
 bulk_approval_required:"Bulk delivery requires separate explicit approval"
});
function text(id,value) { const element=$(id); if(element) element.textContent=String(value); }
function setClass(id,className) { const element=$(id); if(element) element.className=className; }
function stamp() {return new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});}
function activity(message) {
 state.events.unshift({at:stamp(),message});
 state.events.length=Math.min(state.events.length,60);
 text("activity-count",state.events.length+" events");
 if($("view-activity").hidden===false) renderActivity();
}
function renderActivity() {
 const ol=$("activity-log"); ol.replaceChildren();
 if(!state.events.length){const li=document.createElement("li");li.className="activity-empty";li.textContent="No events recorded yet.";ol.append(li);return;}
 for(const event of state.events) {
  const li=document.createElement("li"),time=document.createElement("time"),span=document.createElement("span");
  time.textContent=event.at;span.textContent=event.message;li.append(time,span);ol.append(li);
 }
}
function navigate(value) {
 const page=pages.includes(value)?value:"overview";
 for(const name of pages) $("view-"+name).hidden=name!==page;
 for(const button of document.querySelectorAll("[data-page]")) {
  const active=button.dataset.page===page;
  if(button.classList.contains("nav-item")) { button.classList.toggle("active",active);if(active)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current"); }
 }
 text("breadcrumb-name",labels[page]);
 $("sidebar").classList.remove("visible");
 if(window.location.hash.slice(1)!==page) window.history.replaceState(null,"","#"+page);
 if(page==="activity") renderActivity();
 window.scrollTo({top:0,behavior:"instant"});
}
async function getJson(url) {
 const response=await fetch(url,{cache:"no-store",headers:{accept:"application/json"},credentials:"same-origin",signal:AbortSignal.timeout(7000)});
 if(!response.ok) throw new Error("HTTP "+response.status);
 return await response.json();
}
async function postJson(url,payload) {
 const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},credentials:"same-origin",body:JSON.stringify(payload),signal:AbortSignal.timeout(7000)});
 if(response.status!==200&&response.status!==422) throw new Error("API returned HTTP "+response.status);
 return {code:response.status,data:await response.json()};
}
function wasHealthy(result){return result.status==="fulfilled"&&result.value?.status==="ok";}
function renderCard(id,ok,subtitle) {
 text(id,ok?"Online":"Unavailable");
 setClass(id,"stat-value "+(ok?"ok":"error"));
 text(id==="app-health"?"app-sub":"adapter-sub",subtitle);
 setClass(id==="app-health"?"app-dot":"adapter-dot","status-dot "+(ok?"good":"bad"));
}
function publicApiResult(value) {
 if(!value||typeof value!=="object")return {status:"invalid"};
 return {status:value.status??"unknown",service:value.service??"unknown",command_authority:value.command_authority??null};
}
function publicAdapterResult(value) {
 if(!value||typeof value!=="object")return {status:"invalid"};
 return {status:value.status??"unknown",service:value.service??"unknown",external_send_enabled:value.external_send_enabled===true};
}
function asResult(r,transform) {
 return r.status==="fulfilled"?{ok:true,response:transform(r.value)}:{ok:false,error:String(r.reason?.message??"request failed")};
}
function renderProvider(r) {
 if(r.status!=="fulfilled"){text("provider-evolution","Unavailable");text("provider-meta","Unavailable");return;}
 const providers=r.value?.providers??{};
 for(const [provider,id] of [["evolution","provider-evolution"],["meta","provider-meta"]]){
  const configured=providers?.[provider]?.configured===true;
  text(id,configured?"Configured":"Not configured");
  setClass(id,"provider-state "+(configured?"ready":""));
 }
}
function renderGraph() {
 const group=$("chart-lines");group.replaceChildren();
 text("sample-count",state.samples.length+" samples");
 text("diagnostic-samples",state.samples.length);
 if(state.samples.length<2){$("chart-empty").hidden=false;return;}
 $("chart-empty").hidden=true;
 for(const [field,color] of [["app","#41dba9"],["adapter","#6fb8ec"]]) {
  const poly=document.createElementNS("http://www.w3.org/2000/svg","polyline");
  const points=state.samples.map((s,i)=>[18+i*684/(state.samples.length-1),s[field]?35:135]);
  poly.setAttribute("points",points.map(([x,y])=>x.toFixed(2)+","+y).join(" "));
  poly.setAttribute("stroke",color);poly.setAttribute("class","health-path");
  group.append(poly);
  const dot=document.createElementNS("http://www.w3.org/2000/svg","circle");
  const last=points[points.length-1];dot.setAttribute("cx",last[0]);dot.setAttribute("cy",last[1]);
  dot.setAttribute("r","4");dot.setAttribute("fill",color);group.append(dot);
 }
}
async function refresh({record=true}={}) {
 if(state.updating)return;
 state.updating=true;
 const controls=[$("refresh"),...document.querySelectorAll("[data-refresh]")];
 for(const button of controls)button.disabled=true;
 try {
  const [app,appReady,adapter,adapterReady,middleware]=await Promise.allSettled([
   getJson(endpoints.app),getJson(endpoints.appReady),getJson(endpoints.adapter),getJson(endpoints.adapterReady),getJson(endpoints.middleware)
  ]);
  const appUp=wasHealthy(app),adapterUp=wasHealthy(adapter);
  renderCard("app-health",appUp,appUp?"API responded successfully":"Health check did not succeed");
  renderCard("adapter-health",adapterUp,adapterUp?"Provider adapter responding":"Adapter health check failed");
  text("connection-api",appUp?"Online":"Unavailable");text("connection-adapter",adapterUp?"Online":"Unavailable");
  const middlewareUp=middleware.status==="fulfilled" && middleware.value?.status==="ready" && middleware.value?.service==="middleware-integration-api";
  text("connection-middleware",middlewareUp?"Online":"Unavailable");
  setClass("connection-middleware",middlewareUp?"":"amber");
  text("diagnostic-middleware",middlewareUp?"Online · verified via edge":"Unavailable");
  const ready=appReady.status==="fulfilled"?appReady.value:null;
  if(ready?.safe_mode===true){text("send-mode","Locked");setClass("send-mode","stat-value amber");}
  else{ text("send-mode",ready?"REVIEW":"Unknown");setClass("send-mode","stat-value error"); }
  const registered=ready?.middleware_command_type_configured===true;
  text("command-mode",registered?"Configured":"Not registered");
  text("command-sub",registered?"Registration claimed; not externally certified":"Approved command family not present");
  text("gate-command",registered?"Review needed":"Pending");
  text("gate-infra",appUp&&adapterUp?"Healthy":"Attention");
  text("diagnostic-registry",registered?"Configured; certification pending":"Not registered");
  renderProvider(adapterReady);
  const appResult={health:asResult(app,publicApiResult),ready:asResult(appReady,v=>({status:v.status??"unknown",safe_mode:v.safe_mode===true,middleware_command_type_configured:v.middleware_command_type_configured===true,registry_dependency:v.registry_dependency??null}))};
  const adapterResult={health:asResult(adapter,publicAdapterResult),ready:asResult(adapterReady,v=>({safe_mode:v.safe_mode===true,providers:{evolution:{configured:v.providers?.evolution?.configured===true},meta:{configured:v.providers?.meta?.configured===true}}}))};
  const last=new Date().toISOString();
  const middlewareResult=asResult(middleware,v=>({status:v.status??"unknown",service:v.service??"unknown",delivery:v.delivery??"unknown",checked_at:v.checked_at??null}));
  state.latest={timestamp:last,app:appResult,adapter:adapterResult,middleware:middlewareResult};
  text("api-json",JSON.stringify(appResult,null,2));
  text("adapter-json",JSON.stringify(adapterResult,null,2));
  text("api-code",appUp?"200 OK":"FAILED");text("adapter-code",adapterUp?"200 OK":"FAILED");
  text("last-updated","Last checked "+stamp());
  state.samples.push({at:last,app:appUp,adapter:adapterUp});
  if(state.samples.length>40)state.samples.shift();
  renderGraph();
  if(record)activity("Health check: application "+(appUp?"online":"unavailable")+", adapter "+(adapterUp?"online":"unavailable"));
 } catch(error) {activity("Status check failed: "+String(error.message||error));}
 finally {state.updating=false;for(const button of controls)button.disabled=false;}
}
function updateResult(id,label,ok,details) {
 const node=$(id);node.className="result-box "+(ok?"approved":"rejected");node.replaceChildren();
 const icon=document.createElement("span");icon.className="result-icon";icon.textContent=ok?"✓":"!";
 const heading=document.createElement("strong");heading.textContent=label;
 const paragraph=document.createElement("p");paragraph.textContent=details;
 node.append(icon,heading,paragraph);
}
function decisionResult(id,label,ok,issues,detail) {
 updateResult(id,label,ok,detail);
 if(issues?.length) {
  const list=document.createElement("ul");list.className="result-reasons";
  for(const code of issues) {const li=document.createElement("li");li.textContent=reasons[code]||String(code);list.append(li);}
  $(id).append(list);
 }
}
async function eligibilitySubmit(event) {
 event.preventDefault();
 const button=event.currentTarget.querySelector("button[type=submit]");button.disabled=true;
 const body={recipient:$("recipient").value.trim(),consent_status:$("consent").value,suppressed:$("suppressed").checked,opted_out:$("opted-out").checked};
 try{
  const {data}=await postJson("/api/contacts/eligibility",body);
  const eligible=data.eligible===true;
  decisionResult("eligibility-result",eligible?"Eligible under policy":"Recipient ineligible",eligible,data.reasons,eligible?"Required opt-in conditions satisfied. Message sending still disabled.":"One or more strict eligibility conditions failed.");
  activity("Contact eligibility test completed: "+(eligible?"eligible":"ineligible")+" (no contact recorded)");
 }catch(error){updateResult("eligibility-result","API unavailable",false,error.message);activity("Contact validation failed: API unavailable");}
 finally{button.disabled=false;}
}
async function campaignSubmit(event) {
 event.preventDefault();
 const button=event.currentTarget.querySelector("button[type=submit]");button.disabled=true;
 const body={owner_id:$("owner").value.trim(),template_id:$("template-id").value.trim(),audience_count:Number($("audience").value),bulk_approved:$("bulk-approved").checked};
 try{
  const {data}=await postJson("/api/campaigns/validate",body);
  const valid=data.valid===true;
  decisionResult("campaign-result",valid?"Draft passes policy":"Validation incomplete",valid,data.errors,valid?"Basic requirements satisfied. Campaign was not saved or activated.":"Review the missing requirements below.");
  activity("Campaign draft validation completed: "+(valid?"passed":"blocked")+" (no campaign recorded)");
 }catch(error){updateResult("campaign-result","API unavailable",false,error.message);activity("Campaign validation failed: API unavailable");}
 finally{button.disabled=false;}
}
function exportEvidence() {
 if(!state.latest){activity("Export unavailable: no health reading yet");return;}
 const payload={schema:"codestra-whatsapp-staging-health.v1",environment:"staging",production_approved:false,exported_at:new Date().toISOString(),...state.latest,samples:[...state.samples]};
 const blob=new Blob([JSON.stringify(payload,null,2)+"\n"],{type:"application/json"});
 const url=URL.createObjectURL(blob);const anchor=document.createElement("a");
 anchor.href=url;anchor.download="codestra-whatsapp-health-"+new Date().toISOString().slice(0,10)+".json";
 document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 activity("Downloaded a health evidence snapshot");
}
function init() {
 for(const button of document.querySelectorAll("[data-page]"))button.addEventListener("click",()=>navigate(button.dataset.page));
 $("menu").addEventListener("click",()=>$("sidebar").classList.toggle("visible"));
 $("refresh").addEventListener("click",()=>refresh());
 for(const button of document.querySelectorAll("[data-refresh]"))button.addEventListener("click",()=>refresh());
 $("eligibility-form").addEventListener("submit",eligibilitySubmit);
 $("campaign-form").addEventListener("submit",campaignSubmit);
 $("export").addEventListener("click",exportEvidence);
 $("clear-activity").addEventListener("click",()=>{state.events=[];renderActivity();text("activity-count","0 events");});
 window.addEventListener("hashchange",()=>navigate(window.location.hash.slice(1)));
 text("top-clock",new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
 navigate(window.location.hash.slice(1));
 refresh();
 setInterval(()=>refresh(),30000);
 setInterval(()=>text("top-clock",new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})),60000);
}
init();
