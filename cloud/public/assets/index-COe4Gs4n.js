var bo=Object.defineProperty;var as=e=>{throw TypeError(e)};var wo=(e,t,n)=>t in e?bo(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var qe=(e,t,n)=>wo(e,typeof t!="symbol"?t+"":t,n),ri=(e,t,n)=>t.has(e)||as("Cannot "+n);var v=(e,t,n)=>(ri(e,t,"read from private field"),n?n.call(e):t.get(e)),F=(e,t,n)=>t.has(e)?as("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,n),z=(e,t,n,r)=>(ri(e,t,"write to private field"),r?r.call(e,n):t.set(e,n),n),X=(e,t,n)=>(ri(e,t,"access private method"),n);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))r(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&r(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function r(i){if(i.ep)return;i.ep=!0;const s=n(i);fetch(i.href,s)}})();const zs=!1;var hr=Array.isArray,xo=Array.prototype.indexOf,Or=Array.prototype.includes,Br=Array.from,Eo=Object.defineProperty,Ft=Object.getOwnPropertyDescriptor,Us=Object.getOwnPropertyDescriptors,So=Object.prototype,ko=Array.prototype,Oi=Object.getPrototypeOf,os=Object.isExtensible;function Jn(e){return typeof e=="function"}const be=()=>{};function No(e){return e()}function hi(e){for(var t=0;t<e.length;t++)e[t]()}function Fs(){var e,t,n=new Promise((r,i)=>{e=r,t=i});return{promise:n,resolve:e,reject:t}}function Ao(e,t){if(Array.isArray(e))return e;if(!(Symbol.iterator in e))return Array.from(e);const n=[];for(const r of e)if(n.push(r),n.length===t)break;return n}const Re=2,Ln=4,pr=8,Di=1<<24,yt=16,dt=32,qt=64,pi=128,ut=512,Ae=1024,Me=2048,ft=4096,We=8192,nt=16384,qn=32768,mi=1<<25,nn=65536,Dr=1<<17,$o=1<<18,Hn=1<<19,js=1<<20,$t=1<<25,mn=65536,Rr=1<<21,$n=1<<22,tn=1<<23,Tt=Symbol("$state"),Vs=Symbol("legacy props"),To=Symbol(""),Ar=Symbol("attributes"),_i=Symbol("class"),gi=Symbol("style"),er=Symbol("text"),$r=Symbol("form reset"),mr=new class extends Error{constructor(){super(...arguments);qe(this,"name","StaleReactionError");qe(this,"message","The reaction that called `getAbortSignal()` was re-run or destroyed")}};var Ds;const Wr=!!((Ds=globalThis.document)!=null&&Ds.contentType)&&globalThis.document.contentType.includes("xml");function qs(e){throw new Error("https://svelte.dev/e/lifecycle_outside_component")}function Io(){throw new Error("https://svelte.dev/e/async_derived_orphan")}function Mo(e,t,n){throw new Error("https://svelte.dev/e/each_key_duplicate")}function Co(e){throw new Error("https://svelte.dev/e/effect_in_teardown")}function Po(){throw new Error("https://svelte.dev/e/effect_in_unowned_derived")}function Oo(e){throw new Error("https://svelte.dev/e/effect_orphan")}function Do(){throw new Error("https://svelte.dev/e/effect_update_depth_exceeded")}function Ro(e){throw new Error("https://svelte.dev/e/props_invalid_value")}function Lo(){throw new Error("https://svelte.dev/e/state_descriptors_fixed")}function zo(){throw new Error("https://svelte.dev/e/state_prototype_fixed")}function Uo(){throw new Error("https://svelte.dev/e/state_unsafe_mutation")}function Fo(){throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror")}const jo=1,Vo=2,Hs=4,qo=8,Ho=16,Bo=1,Wo=2,Ko=4,Go=8,Yo=16,Jo=1,Qo=2,Ne=Symbol("uninitialized"),Bs="http://www.w3.org/1999/xhtml",Zo="http://www.w3.org/2000/svg",Xo="@attach";function el(){console.warn("https://svelte.dev/e/derived_inert")}function tl(){console.warn("https://svelte.dev/e/select_multiple_invalid_value")}function nl(){console.warn("https://svelte.dev/e/svelte_boundary_reset_noop")}function Ws(e){return e===this.v}function rl(e,t){return e!=e?t==t:e!==t||e!==null&&typeof e=="object"||typeof e=="function"}function Ks(e){return!rl(e,this.v)}let Bn=!1,il=!1;function sl(){Bn=!0}let le=null;function zn(e){le=e}function ee(e,t=!1,n){le={p:le,i:!1,c:null,e:null,s:e,x:null,r:B,l:Bn&&!t?{s:null,u:null,$:[]}:null}}function te(e){var t=le,n=t.e;if(n!==null){t.e=null;for(var r of n)pa(r)}return e!==void 0&&(t.x=e),t.i=!0,le=t.p,e??{}}function _r(){return!Bn||le!==null&&le.l===null}let rn=[];function Gs(){var e=rn;rn=[],hi(e)}function jt(e){if(rn.length===0&&!ar){var t=rn;queueMicrotask(()=>{t===rn&&Gs()})}rn.push(e)}function al(){for(;rn.length>0;)Gs()}function Ys(e){var t=B;if(t===null)return K.f|=tn,e;if((t.f&qn)===0&&(t.f&Ln)===0)throw e;Xt(e,t)}function Xt(e,t){if(!(t!==null&&(t.f&nt)!==0)){for(;t!==null;){if((t.f&pi)!==0){if((t.f&qn)===0)throw e;try{t.b.error(e);return}catch(n){e=n}}t=t.parent}throw e}}const ol=-7169;function _e(e,t){e.f=e.f&ol|t}function Ri(e){(e.f&ut)!==0||e.deps===null?_e(e,Ae):_e(e,ft)}function Js(e){if(e!==null)for(const t of e)(t.f&Re)===0||(t.f&mn)===0||(t.f^=mn,Js(t.deps))}function Qs(e,t,n){(e.f&Me)!==0?t.add(e):(e.f&ft)!==0&&n.add(e),Js(e.deps),_e(e,Ae)}let Sr=!1;function ll(e){var t=Sr;try{return Sr=!1,[e(),Sr]}finally{Sr=t}}function cl(e,t){if(t){const n=document.body;e.autofocus=!0,jt(()=>{document.activeElement===n&&e.focus()})}}let ls=!1;function ul(){ls||(ls=!0,document.addEventListener("reset",e=>{Promise.resolve().then(()=>{var t;if(!e.defaultPrevented)for(const n of e.target.elements)(t=n[$r])==null||t.call(n)})},{capture:!0}))}function Wn(e){var t=K,n=B;vt(null),ht(null);try{return e()}finally{vt(t),ht(n)}}function fl(e,t,n,r=n){e.addEventListener(t,()=>Wn(n));const i=e[$r];i?e[$r]=()=>{i(),r(!0)}:e[$r]=()=>r(!0),ul()}function dl(e){let t=0,n=gn(0),r;return()=>{Fi()&&(a(n),br(()=>(t===0&&(r=M(()=>e(()=>or(n)))),t+=1,()=>{jt(()=>{t-=1,t===0&&(r==null||r(),r=void 0,or(n))})})))}}var vl=nn|Hn;function hl(e,t,n,r){new pl(e,t,n,r)}var ot,Pi,lt,on,Ye,ct,He,et,Dt,ln,Qt,In,cr,ur,Rt,Vr,ye,ml,_l,gl,yi,Tr,Ir,bi,wi;class pl{constructor(t,n,r,i){F(this,ye);qe(this,"parent");qe(this,"is_pending",!1);qe(this,"transform_error");F(this,ot);F(this,Pi,null);F(this,lt);F(this,on);F(this,Ye);F(this,ct,null);F(this,He,null);F(this,et,null);F(this,Dt,null);F(this,ln,0);F(this,Qt,0);F(this,In,!1);F(this,cr,new Set);F(this,ur,new Set);F(this,Rt,null);F(this,Vr,dl(()=>(z(this,Rt,gn(v(this,ln))),()=>{z(this,Rt,null)})));var s;z(this,ot,t),z(this,lt,n),z(this,on,o=>{var l=B;l.b=this,l.f|=pi,r(o)}),this.parent=B.b,this.transform_error=i??((s=this.parent)==null?void 0:s.transform_error)??(o=>o),z(this,Ye,wr(()=>{X(this,ye,yi).call(this)},vl))}defer_effect(t){Qs(t,v(this,cr),v(this,ur))}is_rendered(){return!this.is_pending&&(!this.parent||this.parent.is_rendered())}has_pending_snippet(){return!!v(this,lt).pending}update_pending_count(t,n){X(this,ye,bi).call(this,t,n),z(this,ln,v(this,ln)+t),!(!v(this,Rt)||v(this,In))&&(z(this,In,!0),jt(()=>{z(this,In,!1),v(this,Rt)&&Fn(v(this,Rt),v(this,ln))}))}get_effect_pending(){return v(this,Vr).call(this),a(v(this,Rt))}error(t){if(!v(this,lt).onerror&&!v(this,lt).failed)throw t;D!=null&&D.is_fork?(v(this,ct)&&D.skip_effect(v(this,ct)),v(this,He)&&D.skip_effect(v(this,He)),v(this,et)&&D.skip_effect(v(this,et)),D.oncommit(()=>{X(this,ye,wi).call(this,t)})):X(this,ye,wi).call(this,t)}}ot=new WeakMap,Pi=new WeakMap,lt=new WeakMap,on=new WeakMap,Ye=new WeakMap,ct=new WeakMap,He=new WeakMap,et=new WeakMap,Dt=new WeakMap,ln=new WeakMap,Qt=new WeakMap,In=new WeakMap,cr=new WeakMap,ur=new WeakMap,Rt=new WeakMap,Vr=new WeakMap,ye=new WeakSet,ml=function(){try{z(this,ct,Ze(()=>v(this,on).call(this,v(this,ot))))}catch(t){this.error(t)}},_l=function(t){const n=v(this,lt).failed;n&&z(this,et,Ze(()=>{n(v(this,ot),()=>t,()=>()=>{})}))},gl=function(){const t=v(this,lt).pending;t&&(this.is_pending=!0,z(this,He,Ze(()=>t(v(this,ot)))),jt(()=>{var n=z(this,Dt,document.createDocumentFragment()),r=It();n.append(r),z(this,ct,X(this,ye,Ir).call(this,()=>Ze(()=>v(this,on).call(this,r)))),v(this,Qt)===0&&(v(this,ot).before(n),z(this,Dt,null),vn(v(this,He),()=>{z(this,He,null)}),X(this,ye,Tr).call(this,D))}))},yi=function(){try{if(this.is_pending=this.has_pending_snippet(),z(this,Qt,0),z(this,ln,0),z(this,ct,Ze(()=>{v(this,on).call(this,v(this,ot))})),v(this,Qt)>0){var t=z(this,Dt,document.createDocumentFragment());qi(v(this,ct),t);const n=v(this,lt).pending;z(this,He,Ze(()=>n(v(this,ot))))}else X(this,ye,Tr).call(this,D)}catch(n){this.error(n)}},Tr=function(t){this.is_pending=!1,t.transfer_effects(v(this,cr),v(this,ur))},Ir=function(t){var n=B,r=K,i=le;ht(v(this,Ye)),vt(v(this,Ye)),zn(v(this,Ye).ctx);try{return _n.ensure(),t()}catch(s){return Ys(s),null}finally{ht(n),vt(r),zn(i)}},bi=function(t,n){var r;if(!this.has_pending_snippet()){this.parent&&X(r=this.parent,ye,bi).call(r,t,n);return}z(this,Qt,v(this,Qt)+t),v(this,Qt)===0&&(X(this,ye,Tr).call(this,n),v(this,He)&&vn(v(this,He),()=>{z(this,He,null)}),v(this,Dt)&&(v(this,ot).before(v(this,Dt)),z(this,Dt,null)))},wi=function(t){v(this,ct)&&(Fe(v(this,ct)),z(this,ct,null)),v(this,He)&&(Fe(v(this,He)),z(this,He,null)),v(this,et)&&(Fe(v(this,et)),z(this,et,null));var n=v(this,lt).onerror;let r=v(this,lt).failed;var i=!1,s=!1;const o=()=>{if(i){nl();return}i=!0,s&&Fo(),v(this,et)!==null&&vn(v(this,et),()=>{z(this,et,null)}),X(this,ye,Ir).call(this,()=>{X(this,ye,yi).call(this)})},l=c=>{try{s=!0,n==null||n(c,o),s=!1}catch(u){Xt(u,v(this,Ye)&&v(this,Ye).parent)}r&&z(this,et,X(this,ye,Ir).call(this,()=>{try{return Ze(()=>{var u=B;u.b=this,u.f|=pi,r(v(this,ot),()=>c,()=>o)})}catch(u){return Xt(u,v(this,Ye).parent),null}}))};jt(()=>{var c;try{c=this.transform_error(t)}catch(u){Xt(u,v(this,Ye)&&v(this,Ye).parent);return}c!==null&&typeof c=="object"&&typeof c.then=="function"?c.then(l,u=>Xt(u,v(this,Ye)&&v(this,Ye).parent)):l(c)})};function Zs(e,t,n,r){const i=_r()?Un:Ut;var s=e.filter(h=>!h.settled),o=t.map(i);if(n.length===0&&s.length===0){r(o);return}var l=B,c=yl(),u=s.length===1?s[0].promise:s.length>1?Promise.all(s.map(h=>h.promise)):null;function d(h){if((l.f&nt)===0){c();try{r([...o,...h])}catch(m){Xt(m,l)}Lr()}}var p=Xs();if(n.length===0){u.then(()=>d([])).finally(p);return}function f(){Promise.all(n.map(h=>bl(h))).then(d).catch(h=>Xt(h,l)).finally(p)}u?u.then(()=>{c(),f(),Lr()}):f()}function yl(){var e=B,t=K,n=le,r=D;return function(s=!0){ht(e),vt(t),zn(n),s&&(e.f&nt)===0&&(r==null||r.activate(),r==null||r.apply())}}function Lr(e=!0){ht(null),vt(null),zn(null),e&&(D==null||D.deactivate())}function Xs(){var e=B,t=e.b,n=D,r=!!(t!=null&&t.is_rendered());return t==null||t.update_pending_count(1,n),n.increment(r,e),()=>{t==null||t.update_pending_count(-1,n),n.decrement(r,e)}}function Un(e){var t=Re|Me;return B!==null&&(B.f|=Hn),{ctx:le,deps:null,effects:null,equals:Ws,f:t,fn:e,reactions:null,rv:0,v:Ne,wv:0,parent:B,ac:null}}const tr=Symbol("obsolete");function bl(e,t,n){let r=B;r===null&&Io();var i=void 0,s=gn(Ne),o=!K,l=new Set;return Ol(()=>{var h,m;var c=B,u=Fs();i=u.promise;try{Promise.resolve(e()).then(u.resolve,b=>{b!==mr&&u.reject(b)}).finally(Lr)}catch(b){u.reject(b),Lr()}var d=D;if(o){if((c.f&qn)!==0)var p=Xs();if((h=r.b)!=null&&h.is_rendered())(m=d.async_deriveds.get(c))==null||m.reject(tr);else for(const b of l.values())b.reject(tr);l.add(u),d.async_deriveds.set(c,u)}const f=(b,_=void 0)=>{p==null||p(),l.delete(u),_!==tr&&(d.activate(),_?(s.f|=tn,Fn(s,_)):((s.f&tn)!==0&&(s.f^=tn),Fn(s,b)),d.deactivate())};u.promise.then(f,b=>f(null,b||"unknown"))}),yr(()=>{for(const c of l)c.reject(tr)}),new Promise(c=>{function u(d){function p(){d===i?c(s):u(i)}d.then(p,p)}u(i)})}function kn(e){const t=Un(e);return wa(t),t}function Ut(e){const t=Un(e);return t.equals=Ks,t}function wl(e){var t=e.effects;if(t!==null){e.effects=null;for(var n=0;n<t.length;n+=1)Fe(t[n])}}function Li(e){var t,n=B,r=e.parent;if(!Ht&&r!==null&&e.v!==Ne&&(r.f&(nt|We))!==0)return el(),e.v;ht(r);try{e.f&=~mn,wl(e),t=ka(e)}finally{ht(n)}return t}function ea(e){var t=Li(e);if(!e.equals(t)&&(e.wv=Ea(),(!(D!=null&&D.is_fork)||e.deps===null)&&(D!==null?(D.capture(e,t,!0),sr==null||sr.capture(e,t,!0)):e.v=t,e.deps===null))){_e(e,Ae);return}Ht||(Ue!==null?(Fi()||D!=null&&D.is_fork)&&Ue.set(e,t):Ri(e))}function xl(e){var t;if(e.effects!==null)for(const n of e.effects)(n.teardown||n.ac)&&((t=n.teardown)==null||t.call(n),n.ac!==null&&Wn(()=>{n.ac.abort(mr),n.ac=null}),n.fn!==null&&(n.teardown=be),lr(n,0),Vi(n))}function ta(e){if(e.effects!==null)for(const t of e.effects)t.teardown&&t.fn!==null&&yn(t)}let ii=null,xn=null,D=null,sr=null,Ue=null,xi=null,ar=!1,si=!1,Nn=null,Mr=null;var cs=0;let El=1;var Mn,Zt,cn,Cn,Pn,On,Lt,Dn,Je,fr,zt,_t,Nt,Rn,un,se,Ei,nr,Si,na,ra,Sn,Sl,rr;const qr=class qr{constructor(){F(this,se);qe(this,"id",El++);F(this,Mn,!1);qe(this,"linked",!0);F(this,Zt,null);F(this,cn,null);qe(this,"async_deriveds",new Map);qe(this,"current",new Map);qe(this,"previous",new Map);F(this,Cn,new Set);F(this,Pn,new Set);F(this,On,0);F(this,Lt,new Map);F(this,Dn,null);F(this,Je,[]);F(this,fr,[]);F(this,zt,new Set);F(this,_t,new Set);F(this,Nt,new Map);F(this,Rn,new Set);qe(this,"is_fork",!1);F(this,un,!1);xn===null?ii=xn=this:(z(xn,cn,this),z(this,Zt,xn)),xn=this}skip_effect(t){v(this,Nt).has(t)||v(this,Nt).set(t,{d:[],m:[]}),v(this,Rn).delete(t)}unskip_effect(t,n=r=>this.schedule(r)){var r=v(this,Nt).get(t);if(r){v(this,Nt).delete(t);for(var i of r.d)_e(i,Me),n(i);for(i of r.m)_e(i,ft),n(i)}v(this,Rn).add(t)}capture(t,n,r=!1){t.v!==Ne&&!this.previous.has(t)&&this.previous.set(t,t.v),(t.f&tn)===0&&(this.current.set(t,[n,r]),Ue==null||Ue.set(t,n)),this.is_fork||(t.v=n)}activate(){D=this}deactivate(){D=null,Ue=null}flush(){try{si=!0,D=this,X(this,se,nr).call(this)}finally{cs=0,xi=null,Nn=null,Mr=null,si=!1,D=null,Ue=null,dn.clear()}}discard(){var t;for(const n of v(this,Pn))n(this);v(this,Pn).clear();for(const n of this.async_deriveds.values())n.reject(tr);X(this,se,rr).call(this),(t=v(this,Dn))==null||t.resolve()}register_created_effect(t){v(this,fr).push(t)}increment(t,n){if(z(this,On,v(this,On)+1),t){let r=v(this,Lt).get(n)??0;v(this,Lt).set(n,r+1)}}decrement(t,n){if(z(this,On,v(this,On)-1),t){let r=v(this,Lt).get(n)??0;r===1?v(this,Lt).delete(n):v(this,Lt).set(n,r-1)}v(this,un)||(z(this,un,!0),jt(()=>{z(this,un,!1),this.linked&&this.flush()}))}transfer_effects(t,n){for(const r of t)v(this,zt).add(r);for(const r of n)v(this,_t).add(r);t.clear(),n.clear()}oncommit(t){v(this,Cn).add(t)}ondiscard(t){v(this,Pn).add(t)}settled(){return(v(this,Dn)??z(this,Dn,Fs())).promise}static ensure(){if(D===null){const t=D=new qr;!si&&!ar&&jt(()=>{v(t,Mn)||t.flush()})}return D}apply(){{Ue=null;return}}schedule(t){var i;if(xi=t,(i=t.b)!=null&&i.is_pending&&(t.f&(Ln|pr|Di))!==0&&(t.f&qn)===0){t.b.defer_effect(t);return}for(var n=t;n.parent!==null;){n=n.parent;var r=n.f;if(Nn!==null&&n===B&&(K===null||(K.f&Re)===0))return;if((r&(qt|dt))!==0){if((r&Ae)===0)return;n.f^=Ae}}v(this,Je).push(n)}};Mn=new WeakMap,Zt=new WeakMap,cn=new WeakMap,Cn=new WeakMap,Pn=new WeakMap,On=new WeakMap,Lt=new WeakMap,Dn=new WeakMap,Je=new WeakMap,fr=new WeakMap,zt=new WeakMap,_t=new WeakMap,Nt=new WeakMap,Rn=new WeakMap,un=new WeakMap,se=new WeakSet,Ei=function(){if(this.is_fork)return!0;for(const r of v(this,Lt).keys()){for(var t=r,n=!1;t.parent!==null;){if(v(this,Nt).has(t)){n=!0;break}t=t.parent}if(!n)return!0}return!1},nr=function(){var c,u,d,p;z(this,Mn,!0),cs++>1e3&&(X(this,se,rr).call(this),Nl());for(const f of v(this,zt))v(this,_t).delete(f),_e(f,Me),this.schedule(f);for(const f of v(this,_t))_e(f,ft),this.schedule(f);const t=v(this,Je);z(this,Je,[]),this.apply();var n=Nn=[],r=[],i=Mr=[];for(const f of t)try{X(this,se,Si).call(this,f,n,r)}catch(h){throw aa(f),X(this,se,Ei).call(this)||this.discard(),h}if(D=null,i.length>0){var s=qr.ensure();for(const f of i)s.schedule(f)}if(Nn=null,Mr=null,X(this,se,Ei).call(this)){X(this,se,Sn).call(this,r),X(this,se,Sn).call(this,n);for(const[f,h]of v(this,Nt))sa(f,h);i.length>0&&X(c=D,se,nr).call(c);return}const o=X(this,se,na).call(this);if(o){X(this,se,Sn).call(this,r),X(this,se,Sn).call(this,n),X(u=o,se,ra).call(u,this);return}v(this,zt).clear(),v(this,_t).clear();for(const f of v(this,Cn))f(this);v(this,Cn).clear(),sr=this,us(r),us(n),sr=null,(d=v(this,Dn))==null||d.resolve();var l=D;if(v(this,On)===0&&(v(this,Je).length===0||l!==null)&&X(this,se,rr).call(this),v(this,Je).length>0)if(l!==null){const f=l;v(f,Je).push(...v(this,Je).filter(h=>!v(f,Je).includes(h)))}else l=this;l!==null&&X(p=l,se,nr).call(p)},Si=function(t,n,r){t.f^=Ae;for(var i=t.first;i!==null;){var s=i.f,o=(s&(dt|qt))!==0,l=o&&(s&Ae)!==0,c=l||(s&We)!==0||v(this,Nt).has(i);if(!c&&i.fn!==null){o?i.f^=Ae:(s&Ln)!==0?n.push(i):Kn(i)&&((s&yt)!==0&&v(this,_t).add(i),yn(i));var u=i.first;if(u!==null){i=u;continue}}for(;i!==null;){var d=i.next;if(d!==null){i=d;break}i=i.parent}}},na=function(){for(var t=v(this,Zt);t!==null;){if(!t.is_fork){for(const[n,[,r]]of this.current)if(t.current.has(n)&&!r)return t}t=v(t,Zt)}return null},ra=function(t){var r;for(const[i,s]of t.current)!this.previous.has(i)&&t.previous.has(i)&&this.previous.set(i,t.previous.get(i)),this.current.set(i,s);for(const[i,s]of t.async_deriveds){const o=this.async_deriveds.get(i);o&&s.promise.then(o.resolve).catch(o.reject)}t.async_deriveds.clear(),this.transfer_effects(v(t,zt),v(t,_t));const n=i=>{var s=i.reactions;if(s!==null&&!((i.f&Re)!==0&&(i.f&(Me|ft))===0))for(const c of s){var o=c.f;if((o&Re)!==0)n(c);else{var l=c;o&($n|yt)&&!this.async_deriveds.has(l)&&(v(this,_t).delete(l),_e(l,Me),this.schedule(l))}}};for(const i of this.current.keys())n(i);this.oncommit(()=>t.discard()),X(r=t,se,rr).call(r),D=this,X(this,se,nr).call(this)},Sn=function(t){for(var n=0;n<t.length;n+=1)Qs(t[n],v(this,zt),v(this,_t))},Sl=function(){var p;for(let f=ii;f!==null;f=v(f,cn)){var t=f.id<this.id,n=[];for(const[h,[m,b]]of this.current){if(f.current.has(h)){var r=f.current.get(h)[0];if(t&&m!==r)f.current.set(h,[m,b]);else continue}n.push(h)}if(t)for(const[h,m]of this.async_deriveds){const b=f.async_deriveds.get(h);b&&m.promise.then(b.resolve).catch(b.reject)}var i=[...f.current.keys()].filter(h=>!f.current.get(h)[1]);if(!(!v(f,Mn)||i.length===0)){var s=i.filter(h=>!this.current.has(h));if(s.length===0)t&&f.discard();else if(n.length>0){if(t)for(const h of v(this,Rn))f.unskip_effect(h,m=>{var b;(m.f&(yt|$n))!==0?f.schedule(m):X(b=f,se,Sn).call(b,[m])});f.activate();var o=new Set,l=new Map;for(var c of n)ia(c,s,o,l);l=new Map;var u=[...f.current].filter(([h,m])=>{const b=this.current.get(h);return b?b[0]!==m[0]||b[1]!==m[1]:!0}).map(([h])=>h);if(u.length>0)for(const h of v(this,fr))(h.f&(nt|We|Dr))===0&&zi(h,u,l)&&((h.f&($n|yt))!==0?(_e(h,Me),f.schedule(h)):v(f,zt).add(h));if(v(f,Je).length>0&&!v(f,un)){f.apply();for(var d of v(f,Je))X(p=f,se,Si).call(p,d,[],[]);z(f,Je,[])}f.deactivate()}}}},rr=function(){if(this.linked){var t=v(this,Zt),n=v(this,cn);t===null?ii=n:z(t,cn,n),n===null?xn=t:z(n,Zt,t),this.linked=!1}};let _n=qr;function kl(e){var t=ar;ar=!0;try{for(var n;;){if(al(),D===null)return n;D.flush()}}finally{ar=t}}function Nl(){try{Do()}catch(e){Xt(e,xi)}}let mt=null;function us(e){var t=e.length;if(t!==0){for(var n=0;n<t;){var r=e[n++];if((r.f&(nt|We))===0&&Kn(r)&&(mt=new Set,yn(r),r.deps===null&&r.first===null&&r.nodes===null&&r.teardown===null&&r.ac===null&&ga(r),(mt==null?void 0:mt.size)>0)){dn.clear();for(const i of mt){if((i.f&(nt|We))!==0)continue;const s=[i];let o=i.parent;for(;o!==null;)mt.has(o)&&(mt.delete(o),s.push(o)),o=o.parent;for(let l=s.length-1;l>=0;l--){const c=s[l];(c.f&(nt|We))===0&&yn(c)}}mt.clear()}}mt=null}}function ia(e,t,n,r){if(!n.has(e)&&(n.add(e),e.reactions!==null))for(const i of e.reactions){const s=i.f;(s&Re)!==0?ia(i,t,n,r):(s&($n|yt))!==0&&(s&Me)===0&&zi(i,t,r)&&(_e(i,Me),Ui(i))}}function zi(e,t,n){const r=n.get(e);if(r!==void 0)return r;if(e.deps!==null)for(const i of e.deps){if(Or.call(t,i))return!0;if((i.f&Re)!==0&&zi(i,t,n))return n.set(i,!0),!0}return n.set(e,!1),!1}function Ui(e){D.schedule(e)}function sa(e,t){if(!((e.f&dt)!==0&&(e.f&Ae)!==0)){(e.f&Me)!==0?t.d.push(e):(e.f&ft)!==0&&t.m.push(e),_e(e,Ae);for(var n=e.first;n!==null;)sa(n,t),n=n.next}}function aa(e){_e(e,Ae);for(var t=e.first;t!==null;)aa(t),t=t.next}let zr=new Set;const dn=new Map;let oa=!1;function gn(e,t){var n={f:0,v:e,reactions:null,equals:Ws,rv:0,wv:0};return n}function Yt(e,t){const n=gn(e);return wa(n),n}function R(e,t=!1,n=!0){var i;const r=gn(e);return t||(r.equals=Ks),Bn&&n&&le!==null&&le.l!==null&&((i=le.l).s??(i.s=[])).push(r),r}function g(e,t,n=!1){K!==null&&(!bt||(K.f&Dr)!==0)&&_r()&&(K.f&(Re|yt|$n|Dr))!==0&&(Mt===null||!Mt.has(e))&&Uo();let r=n?An(t):t;return Fn(e,r,Mr)}function Fn(e,t,n=null){if(!e.equals(t)){dn.set(e,Ht?t:e.v);var r=_n.ensure();if(r.capture(e,t),(e.f&Re)!==0){const i=e;(e.f&Me)!==0&&Li(i),Ue===null&&Ri(i)}e.wv=Ea(),la(e,Me,n),_r()&&B!==null&&(B.f&Ae)!==0&&(B.f&(dt|qt))===0&&(at===null?Ll([e]):at.push(e)),!r.is_fork&&zr.size>0&&!oa&&Al()}return t}function Al(){oa=!1;for(const e of zr){(e.f&Ae)!==0&&_e(e,ft);let t;try{t=Kn(e)}catch{t=!0}t&&yn(e)}zr.clear()}function or(e){g(e,e.v+1)}function la(e,t,n){var r=e.reactions;if(r!==null)for(var i=_r(),s=r.length,o=0;o<s;o++){var l=r[o],c=l.f;if(!(!i&&l===B)){var u=(c&Me)===0;if(u&&_e(l,t),(c&Dr)!==0)zr.add(l);else if((c&Re)!==0){var d=l;Ue==null||Ue.delete(d),(c&mn)===0&&(c&ut&&(B===null||(B.f&Rr)===0)&&(l.f|=mn),la(d,ft,n))}else if(u){var p=l;(c&yt)!==0&&mt!==null&&mt.add(p),n!==null?n.push(p):Ui(p)}}}}function An(e){if(typeof e!="object"||e===null||Tt in e)return e;const t=Oi(e);if(t!==So&&t!==ko)return e;var n=new Map,r=hr(e),i=Yt(0),s=hn,o=l=>{if(hn===s)return l();var c=K,u=hn;vt(null),hs(s);var d=l();return vt(c),hs(u),d};return r&&n.set("length",Yt(e.length)),new Proxy(e,{defineProperty(l,c,u){(!("value"in u)||u.configurable===!1||u.enumerable===!1||u.writable===!1)&&Lo();var d=n.get(c);return d===void 0?o(()=>{var p=Yt(u.value);return n.set(c,p),p}):g(d,u.value,!0),!0},deleteProperty(l,c){var u=n.get(c);if(u===void 0){if(c in l){const d=o(()=>Yt(Ne));n.set(c,d),or(i)}}else g(u,Ne),or(i);return!0},get(l,c,u){var h;if(c===Tt)return e;var d=n.get(c),p=c in l;if(d===void 0&&(!p||(h=Ft(l,c))!=null&&h.writable)&&(d=o(()=>{var m=An(p?l[c]:Ne),b=Yt(m);return b}),n.set(c,d)),d!==void 0){var f=a(d);return f===Ne?void 0:f}return Reflect.get(l,c,u)},getOwnPropertyDescriptor(l,c){var u=Reflect.getOwnPropertyDescriptor(l,c);if(u&&"value"in u){var d=n.get(c);d&&(u.value=a(d))}else if(u===void 0){var p=n.get(c),f=p==null?void 0:p.v;if(p!==void 0&&f!==Ne)return{enumerable:!0,configurable:!0,value:f,writable:!0}}return u},has(l,c){var f;if(c===Tt)return!0;var u=n.get(c),d=u!==void 0&&u.v!==Ne||Reflect.has(l,c);if(u!==void 0||B!==null&&(!d||(f=Ft(l,c))!=null&&f.writable)){u===void 0&&(u=o(()=>{var h=d?An(l[c]):Ne,m=Yt(h);return m}),n.set(c,u));var p=a(u);if(p===Ne)return!1}return d},set(l,c,u,d){var C;var p=n.get(c),f=c in l;if(r&&c==="length")for(var h=u;h<p.v;h+=1){var m=n.get(h+"");m!==void 0?g(m,Ne):h in l&&(m=o(()=>Yt(Ne)),n.set(h+"",m))}if(p===void 0)(!f||(C=Ft(l,c))!=null&&C.writable)&&(p=o(()=>Yt(void 0)),g(p,An(u)),n.set(c,p));else{f=p.v!==Ne;var b=o(()=>An(u));g(p,b)}var _=Reflect.getOwnPropertyDescriptor(l,c);if(_!=null&&_.set&&_.set.call(d,u),!f){if(r&&typeof c=="string"){var E=n.get("length"),$=Number(c);Number.isInteger($)&&$>=E.v&&g(E,$+1)}or(i)}return!0},ownKeys(l){a(i);var c=Reflect.ownKeys(l).filter(p=>{var f=n.get(p);return f===void 0||f.v!==Ne});for(var[u,d]of n)d.v!==Ne&&!(u in l)&&c.push(u);return c},setPrototypeOf(){zo()}})}function fs(e){try{if(e!==null&&typeof e=="object"&&Tt in e)return e[Tt]}catch{}return e}function $l(e,t){return Object.is(fs(e),fs(t))}var ds,ca,ua,fa;function Tl(){if(ds===void 0){ds=window,ca=/Firefox/.test(navigator.userAgent);var e=Element.prototype,t=Node.prototype,n=Text.prototype;ua=Ft(t,"firstChild").get,fa=Ft(t,"nextSibling").get,os(e)&&(e[_i]=void 0,e[Ar]=null,e[gi]=void 0,e.__e=void 0),os(n)&&(n[er]=void 0)}}function It(e=""){return document.createTextNode(e)}function jn(e){return ua.call(e)}function gr(e){return fa.call(e)}function x(e,t){return jn(e)}function J(e,t=!1){{var n=jn(e);return n instanceof Comment&&n.data===""?gr(n):n}}function A(e,t=1,n=!1){let r=e;for(;t--;)r=gr(r);return r}function Il(e){e.textContent=""}function da(){return!1}function va(e,t,n){return t==null||t===Bs?n?document.createElement(e,{is:n}):document.createElement(e):n?document.createElementNS(t,e,{is:n}):document.createElementNS(t,e)}function ha(e){B===null&&(K===null&&Oo(),Po()),Ht&&Co()}function Ml(e,t){var n=t.last;n===null?t.last=t.first=e:(n.next=e,e.prev=n,t.last=e)}function wt(e,t){var n=B;n!==null&&(n.f&We)!==0&&(e|=We);var r={ctx:le,deps:null,nodes:null,f:e|Me|ut,first:null,fn:t,last:null,next:null,parent:n,b:n&&n.b,prev:null,teardown:null,wv:0,ac:null};D==null||D.register_created_effect(r);var i=r;if((e&Ln)!==0)Nn!==null?Nn.push(r):_n.ensure().schedule(r);else if(t!==null){try{yn(r)}catch(o){throw Fe(r),o}i.deps===null&&i.teardown===null&&i.nodes===null&&i.first===i.last&&(i.f&Hn)===0&&(i=i.first,(e&yt)!==0&&(e&nn)!==0&&i!==null&&(i.f|=nn))}if(i!==null&&(i.parent=n,n!==null&&Ml(i,n),K!==null&&(K.f&Re)!==0&&(e&qt)===0)){var s=K;(s.effects??(s.effects=[])).push(i)}return r}function Fi(){return K!==null&&!bt}function yr(e){const t=wt(pr,null);return _e(t,Ae),t.teardown=e,t}function ki(e){ha();var t=B.f,n=!K&&(t&dt)!==0&&le!==null&&!le.i;if(n){var r=le;(r.e??(r.e=[])).push(e)}else return pa(e)}function pa(e){return wt(Ln|js,e)}function Cl(e){return ha(),wt(pr|js,e)}function Pl(e){_n.ensure();const t=wt(qt|Hn,e);return(n={})=>new Promise(r=>{n.outro?vn(t,()=>{Fe(t),r(void 0)}):(Fe(t),r(void 0))})}function ji(e){return wt(Ln,e)}function Be(e,t){var n=le,r={effect:null,ran:!1,deps:e};n.l.$.push(r),r.effect=br(()=>{if(e(),!r.ran){r.ran=!0;var i=B;try{ht(i.parent),M(t)}finally{ht(i)}}})}function bn(){var e=le;br(()=>{for(var t of e.l.$){t.deps();var n=t.effect;(n.f&Ae)!==0&&n.deps!==null&&_e(n,ft),Kn(n)&&yn(n),t.ran=!1}})}function Ol(e){return wt($n|Hn,e)}function br(e,t=0){return wt(pr|t,e)}function ue(e,t=[],n=[],r=[]){Zs(r,t,n,i=>{wt(pr,()=>{e(...i.map(a))})})}function wr(e,t=0){var n=wt(yt|t,e);return n}function ma(e,t=0){var n=wt(Di|t,e);return n}function Ze(e){return wt(dt|Hn,e)}function _a(e){var t=e.teardown;if(t!==null){const n=Ht,r=K;vs(!0),vt(null);try{t.call(null)}finally{vs(n),vt(r)}}}function Vi(e,t=!1){var n=e.first;for(e.first=e.last=null;n!==null;){const i=n.ac;i!==null&&Wn(()=>{i.abort(mr)});var r=n.next;(n.f&qt)!==0?n.parent=null:Fe(n,t),n=r}}function Dl(e){for(var t=e.first;t!==null;){var n=t.next;(t.f&dt)===0&&Fe(t),t=n}}function Fe(e,t=!0){var n=!1;(t||(e.f&$o)!==0)&&e.nodes!==null&&e.nodes.end!==null&&(Rl(e.nodes.start,e.nodes.end),n=!0),e.f|=mi,Vi(e,t&&!n),lr(e,0);var r=e.nodes&&e.nodes.t;if(r!==null)for(const s of r)s.stop();_a(e),e.f^=mi,e.f|=nt;var i=e.parent;i!==null&&i.first!==null&&ga(e),e.next=e.prev=e.teardown=e.ctx=e.deps=e.fn=e.nodes=e.ac=e.b=null}function Rl(e,t){for(;e!==null;){var n=e===t?null:gr(e);e.remove(),e=n}}function ga(e){var t=e.parent,n=e.prev,r=e.next;n!==null&&(n.next=r),r!==null&&(r.prev=n),t!==null&&(t.first===e&&(t.first=r),t.last===e&&(t.last=n))}function vn(e,t,n=!0){var r=[];ya(e,r,!0);var i=()=>{n&&Fe(e),t&&t()},s=r.length;if(s>0){var o=()=>--s||i();for(var l of r)l.out(o)}else i()}function ya(e,t,n){if((e.f&We)===0){e.f^=We;var r=e.nodes&&e.nodes.t;if(r!==null)for(const l of r)(l.is_global||n)&&t.push(l);for(var i=e.first;i!==null;){var s=i.next;if((i.f&qt)===0){var o=(i.f&nn)!==0||(i.f&dt)!==0&&(e.f&yt)!==0;ya(i,t,o?n:!1)}i=s}}}function Ur(e){ba(e,!0)}function ba(e,t){if((e.f&We)!==0){e.f^=We,(e.f&Ae)===0&&(_e(e,Me),_n.ensure().schedule(e));for(var n=e.first;n!==null;){var r=n.next,i=(n.f&nn)!==0||(n.f&dt)!==0;ba(n,i?t:!1),n=r}var s=e.nodes&&e.nodes.t;if(s!==null)for(const o of s)(o.is_global||t)&&o.in()}}function qi(e,t){if(e.nodes)for(var n=e.nodes.start,r=e.nodes.end;n!==null;){var i=n===r?null:gr(n);t.append(n),n=i}}let Cr=!1,Ht=!1;function vs(e){Ht=e}let K=null,bt=!1;function vt(e){K=e}let B=null;function ht(e){B=e}let Mt=null;function wa(e){K!==null&&(Mt??(Mt=new Set)).add(e)}let Qe=null,Xe=0,at=null;function Ll(e){at=e}let xa=1,sn=0,hn=sn;function hs(e){hn=e}function Ea(){return++xa}function Kn(e){var t=e.f;if((t&Me)!==0)return!0;if(t&Re&&(e.f&=~mn),(t&ft)!==0){for(var n=e.deps,r=n.length,i=0;i<r;i++){var s=n[i];if(Kn(s)&&ea(s),s.wv>e.wv)return!0}(t&ut)!==0&&Ue===null&&_e(e,Ae)}return!1}function Sa(e,t,n=!0){var r=e.reactions;if(r!==null&&!(Mt!==null&&Mt.has(e)))for(var i=0;i<r.length;i++){var s=r[i];(s.f&Re)!==0?Sa(s,t,!1):t===s&&(n?_e(s,Me):(s.f&Ae)!==0&&_e(s,ft),Ui(s))}}function ka(e){var b;var t=Qe,n=Xe,r=at,i=K,s=Mt,o=le,l=bt,c=hn,u=e.f;Qe=null,Xe=0,at=null,K=(u&(dt|qt))===0?e:null,Mt=null,zn(e.ctx),bt=!1,hn=++sn,e.ac!==null&&(Wn(()=>{e.ac.abort(mr)}),e.ac=null);try{e.f|=Rr;var d=e.fn,p=d();e.f|=qn;var f=e.deps,h=D==null?void 0:D.is_fork;if(Qe!==null){var m;if(h||lr(e,Xe),f!==null&&Xe>0)for(f.length=Xe+Qe.length,m=0;m<Qe.length;m++)f[Xe+m]=Qe[m];else e.deps=f=Qe;if(Fi()&&(e.f&ut)!==0)for(m=Xe;m<f.length;m++)((b=f[m]).reactions??(b.reactions=[])).push(e)}else!h&&f!==null&&Xe<f.length&&(lr(e,Xe),f.length=Xe);if(_r()&&at!==null&&!bt&&f!==null&&(e.f&(Re|ft|Me))===0)for(m=0;m<at.length;m++)Sa(at[m],e);if(i!==null&&i!==e){if(sn++,i.deps!==null)for(let _=0;_<n;_+=1)i.deps[_].rv=sn;if(t!==null)for(const _ of t)_.rv=sn;at!==null&&(r===null?r=at:r.push(...at))}return(e.f&tn)!==0&&(e.f^=tn),p}catch(_){return Ys(_)}finally{e.f^=Rr,Qe=t,Xe=n,at=r,K=i,Mt=s,zn(o),bt=l,hn=c}}function zl(e,t){let n=t.reactions;if(n!==null){var r=xo.call(n,e);if(r!==-1){var i=n.length-1;i===0?n=t.reactions=null:(n[r]=n[i],n.pop())}}if(n===null&&(t.f&Re)!==0&&(Qe===null||!Or.call(Qe,t))){var s=t;(s.f&ut)!==0&&(s.f^=ut,s.f&=~mn),s.v!==Ne&&Ri(s),s.ac!==null&&Wn(()=>{s.ac.abort(mr),s.ac=null}),xl(s),lr(s,0)}}function lr(e,t){var n=e.deps;if(n!==null)for(var r=t;r<n.length;r++)zl(e,n[r])}function yn(e){var t=e.f;if((t&nt)===0){_e(e,Ae);var n=B,r=Cr;B=e,Cr=(t&(dt|qt))===0;try{(t&(yt|Di))!==0?Dl(e):Vi(e),_a(e);var i=ka(e);e.teardown=typeof i=="function"?i:null,e.wv=xa;var s;zs&&il&&(e.f&Me)!==0&&e.deps}finally{Cr=r,B=n}}}async function Ul(){await Promise.resolve(),kl()}function a(e){var t=e.f,n=(t&Re)!==0;if(K!==null&&!bt){var r=B!==null&&(B.f&nt)!==0;if(!r&&(Mt===null||!Mt.has(e))){var i=K.deps;if((K.f&Rr)!==0)e.rv<sn&&(e.rv=sn,Qe===null&&i!==null&&i[Xe]===e?Xe++:Qe===null?Qe=[e]:Qe.push(e));else{K.deps??(K.deps=[]),Or.call(K.deps,e)||K.deps.push(e);var s=e.reactions;s===null?e.reactions=[K]:Or.call(s,K)||s.push(K)}}}if(Ht&&dn.has(e))return dn.get(e);if(n){var o=e;if(Ht){var l=o.v;return((o.f&Ae)===0&&o.reactions!==null||Aa(o))&&(l=Li(o)),dn.set(o,l),l}var c=(o.f&ut)===0&&!bt&&K!==null&&(Cr||(K.f&ut)!==0),u=(o.f&qn)===0;Kn(o)&&(c&&(o.f|=ut),ea(o)),c&&!u&&(ta(o),Na(o))}if(Ue!=null&&Ue.has(e))return Ue.get(e);if((e.f&tn)!==0)throw e.v;return e.v}function Na(e){if(e.f|=ut,e.deps!==null)for(const t of e.deps)(t.reactions??(t.reactions=[])).push(e),(t.f&Re)!==0&&(t.f&ut)===0&&(ta(t),Na(t))}function Aa(e){if(e.v===Ne)return!0;if(e.deps===null)return!1;for(const t of e.deps)if(dn.has(t)||(t.f&Re)!==0&&Aa(t))return!0;return!1}function M(e){var t=bt;try{return bt=!0,e()}finally{bt=t}}function we(e){if(!(typeof e!="object"||!e||e instanceof EventTarget)){if(Tt in e)Ni(e);else if(!Array.isArray(e))for(let t in e){const n=e[t];typeof n=="object"&&n&&Tt in n&&Ni(n)}}}function Ni(e,t=new Set){if(typeof e=="object"&&e!==null&&!(e instanceof EventTarget)&&!t.has(e)){t.add(e),e instanceof Date&&e.getTime();for(let r in e)try{Ni(e[r],t)}catch{}const n=Oi(e);if(n!==Object.prototype&&n!==Array.prototype&&n!==Map.prototype&&n!==Set.prototype&&n!==Date.prototype){const r=Us(n);for(let i in r){const s=r[i].get;if(s)try{s.call(e)}catch{}}}}}function Fl(e){return e.endsWith("capture")&&e!=="gotpointercapture"&&e!=="lostpointercapture"}const jl=["beforeinput","click","change","dblclick","contextmenu","focusin","focusout","input","keydown","keyup","mousedown","mousemove","mouseout","mouseover","mouseup","pointerdown","pointermove","pointerout","pointerover","pointerup","touchend","touchmove","touchstart"];function Vl(e){return jl.includes(e)}const ql={formnovalidate:"formNoValidate",ismap:"isMap",nomodule:"noModule",playsinline:"playsInline",readonly:"readOnly",defaultvalue:"defaultValue",defaultchecked:"defaultChecked",srcobject:"srcObject",novalidate:"noValidate",allowfullscreen:"allowFullscreen",disablepictureinpicture:"disablePictureInPicture",disableremoteplayback:"disableRemotePlayback"};function Hl(e){return e=e.toLowerCase(),ql[e]??e}const Bl=["touchstart","touchmove"];function Wl(e){return Bl.includes(e)}const an=Symbol("events"),$a=new Set,Ai=new Set;function Ta(e,t,n,r={}){function i(s){if(r.capture||$i.call(t,s),!s.cancelBubble)return Wn(()=>n==null?void 0:n.call(this,s))}return e.startsWith("pointer")||e.startsWith("touch")||e==="wheel"?jt(()=>{t.addEventListener(e,i,r)}):t.addEventListener(e,i,r),i}function Y(e,t,n,r,i){var s={capture:r,passive:i},o=Ta(e,t,n,s);(t===document.body||t===window||t===document||t instanceof HTMLMediaElement)&&yr(()=>{t.removeEventListener(e,o,s)})}function Kl(e,t,n){(t[an]??(t[an]={}))[e]=n}function Gl(e){for(var t=0;t<e.length;t++)$a.add(e[t]);for(var n of Ai)n(e)}let ps=null;function $i(e){var b,_;var t=this,n=t.ownerDocument,r=e.type,i=((b=e.composedPath)==null?void 0:b.call(e))||[],s=i[0]||e.target;ps=e;var o=0,l=ps===e&&e[an];if(l){var c=i.indexOf(l);if(c!==-1&&(t===document||t===window)){e[an]=t;return}var u=i.indexOf(t);if(u===-1)return;c<=u&&(o=c)}if(s=i[o]||e.target,s!==t){Eo(e,"currentTarget",{configurable:!0,get(){return s||n}});var d=K,p=B;vt(null),ht(null);try{for(var f,h=[];s!==null&&s!==t;){try{var m=(_=s[an])==null?void 0:_[r];m!=null&&(!s.disabled||e.target===s)&&m.call(s,e)}catch(E){f?h.push(E):f=E}if(e.cancelBubble)break;o++,s=o<i.length?i[o]:null}if(f){for(let E of h)queueMicrotask(()=>{throw E});throw f}}finally{e[an]=t,delete e.currentTarget,vt(d),ht(p)}}}var Rs;const ai=((Rs=globalThis==null?void 0:globalThis.window)==null?void 0:Rs.trustedTypes)&&globalThis.window.trustedTypes.createPolicy("svelte-trusted-html",{createHTML:e=>e});function Yl(e){return(ai==null?void 0:ai.createHTML(e))??e}function Ia(e){var t=va("template");return t.innerHTML=Yl(e.replaceAll("<!>","<!---->")),t.content}function Vn(e,t){var n=B;n.nodes===null&&(n.nodes={start:e,end:t,a:null,t:null})}function j(e,t){var n=(t&Jo)!==0,r=(t&Qo)!==0,i,s=!e.startsWith("<!>");return()=>{i===void 0&&(i=Ia(s?e:"<!>"+e),n||(i=jn(i)));var o=r||ca?document.importNode(i,!0):i.cloneNode(!0);if(n){var l=jn(o),c=o.lastChild;Vn(l,c)}else Vn(o,o);return o}}function Jl(e,t,n="svg"){var r=!e.startsWith("<!>"),i=`<${n}>${r?e:"<!>"+e}</${n}>`,s;return()=>{if(!s){var o=Ia(i),l=jn(o);s=jn(l)}var c=s.cloneNode(!0);return Vn(c,c),c}}function Ql(e,t){return Jl(e,t,"svg")}function Tn(e=""){{var t=It(e+"");return Vn(t,t),t}}function ce(){var e=document.createDocumentFragment(),t=document.createComment(""),n=It();return e.append(t,n),Vn(t,n),e}function N(e,t){e!==null&&e.before(t)}function $e(e,t){var n=t==null?"":typeof t=="object"?`${t}`:t;n!==(e[er]??(e[er]=e.nodeValue))&&(e[er]=n,e.nodeValue=`${n}`)}function Zl(e,t){return Xl(e,t)}const kr=new Map;function Xl(e,{target:t,anchor:n,props:r={},events:i,context:s,intro:o=!0,transformError:l}){Tl();var c=void 0,u=Pl(()=>{var d=n??t.appendChild(It());hl(d,{pending:()=>{}},h=>{ee({});var m=le;s&&(m.c=s),i&&(r.$$events=i),c=e(h,r)||{},te()},l);var p=new Set,f=h=>{for(var m=0;m<h.length;m++){var b=h[m];if(!p.has(b)){p.add(b);var _=Wl(b);for(const C of[t,document]){var E=kr.get(C);E===void 0&&(E=new Map,kr.set(C,E));var $=E.get(b);$===void 0?(C.addEventListener(b,$i,{passive:_}),E.set(b,1)):E.set(b,$+1)}}}};return f(Br($a)),Ai.add(f),()=>{var _;for(var h of p)for(const E of[t,document]){var m=kr.get(E),b=m.get(h);--b==0?(E.removeEventListener(h,$i),m.delete(h),m.size===0&&kr.delete(E)):m.set(h,b)}Ai.delete(f),d!==n&&((_=d.parentNode)==null||_.removeChild(d))}});return ec.set(c,u),c}let ec=new WeakMap;var gt,At,tt,fn,dr,vr,Hr;class Hi{constructor(t,n=!0){qe(this,"anchor");F(this,gt,new Map);F(this,At,new Map);F(this,tt,new Map);F(this,fn,new Set);F(this,dr,!0);F(this,vr,t=>{if(v(this,gt).has(t)){var n=v(this,gt).get(t),r=v(this,At).get(n);if(r)Ur(r),v(this,fn).delete(n);else{var i=v(this,tt).get(n);i&&(Ur(i.effect),v(this,At).set(n,i.effect),v(this,tt).delete(n),i.fragment.lastChild.remove(),this.anchor.before(i.fragment),r=i.effect)}for(const[s,o]of v(this,gt)){if(v(this,gt).delete(s),s===t)break;const l=v(this,tt).get(o);l&&(Fe(l.effect),v(this,tt).delete(o))}for(const[s,o]of v(this,At)){if(s===n||v(this,fn).has(s))continue;const l=()=>{if(Array.from(v(this,gt).values()).includes(s)){var u=document.createDocumentFragment();qi(o,u),u.append(It()),v(this,tt).set(s,{effect:o,fragment:u})}else Fe(o);v(this,fn).delete(s),v(this,At).delete(s)};v(this,dr)||!r?(v(this,fn).add(s),vn(o,l,!1)):l()}}});F(this,Hr,t=>{v(this,gt).delete(t);const n=Array.from(v(this,gt).values());for(const[r,i]of v(this,tt))n.includes(r)||(Fe(i.effect),v(this,tt).delete(r))});this.anchor=t,z(this,dr,n)}ensure(t,n){var r=D,i=da();if(n&&!v(this,At).has(t)&&!v(this,tt).has(t))if(i){var s=document.createDocumentFragment(),o=It();s.append(o),v(this,tt).set(t,{effect:Ze(()=>n(o)),fragment:s})}else v(this,At).set(t,Ze(()=>n(this.anchor)));if(v(this,gt).set(r,t),i){for(const[l,c]of v(this,At))l===t?r.unskip_effect(c):r.skip_effect(c);for(const[l,c]of v(this,tt))l===t?r.unskip_effect(c.effect):r.skip_effect(c.effect);r.oncommit(v(this,vr)),r.ondiscard(v(this,Hr))}else v(this,vr).call(this,r)}}gt=new WeakMap,At=new WeakMap,tt=new WeakMap,fn=new WeakMap,dr=new WeakMap,vr=new WeakMap,Hr=new WeakMap;function ie(e,t,n=!1){var r=new Hi(e),i=n?nn:0;function s(o,l){r.ensure(o,l)}wr(()=>{var o=!1;t((l,c=0)=>{o=!0,s(c,l)}),o||s(-1,null)},i)}function Bi(e,t){return t}function tc(e,t,n){for(var r=[],i=t.length,s,o=t.length,l=0;l<i;l++){let p=t[l];vn(p,()=>{if(s){if(s.pending.delete(p),s.done.add(p),s.pending.size===0){var f=e.outrogroups;Ti(e,Br(s.done)),f.delete(s),f.size===0&&(e.outrogroups=null)}}else o-=1},!1)}if(o===0){var c=r.length===0&&n!==null;if(c){var u=n,d=u.parentNode;Il(d),d.append(u),e.items.clear()}Ti(e,t,!c)}else s={pending:new Set(t),done:new Set},(e.outrogroups??(e.outrogroups=new Set)).add(s)}function Ti(e,t,n=!0){var r;if(e.pending.size>0){r=new Set;for(const o of e.pending.values())for(const l of o)r.add(e.items.get(l).e)}for(var i=0;i<t.length;i++){var s=t[i];if(r!=null&&r.has(s)){s.f|=$t;const o=document.createDocumentFragment();qi(s,o)}else Fe(t[i],n)}}var ms;function Gn(e,t,n,r,i,s=null){var o=e,l=new Map,c=(t&Hs)!==0;if(c){var u=e;o=u.appendChild(It())}var d=null,p=Ut(()=>{var C=n();return hr(C)?C:C==null?[]:Br(C)}),f,h=new Map,m=!0;function b(C){($.effect.f&nt)===0&&($.pending.delete(C),$.fallback=d,nc($,f,o,t,r),d!==null&&(f.length===0?(d.f&$t)===0?Ur(d):(d.f^=$t,ir(d,null,o)):vn(d,()=>{d=null})))}function _(C){$.pending.delete(C)}var E=wr(()=>{f=a(p);for(var C=f.length,G=new Set,S=D,k=da(),T=0;T<C;T+=1){var V=f[T],q=r(V,T),Q=m?null:l.get(q);Q?(Q.v&&Fn(Q.v,V),Q.i&&Fn(Q.i,T),k&&S.unskip_effect(Q.e)):(Q=rc(l,m?o:ms??(ms=It()),V,q,T,i,t,n),m||(Q.e.f|=$t),l.set(q,Q)),G.add(q)}if(C===0&&s&&!d&&(m?d=Ze(()=>s(o)):(d=Ze(()=>s(ms??(ms=It()))),d.f|=$t)),C>G.size&&Mo(),!m)if(h.set(S,G),k){for(const[ve,ne]of l)G.has(ve)||S.skip_effect(ne.e);S.oncommit(b),S.ondiscard(_)}else b(S);a(p)}),$={effect:E,items:l,pending:h,outrogroups:null,fallback:d};m=!1}function Qn(e){for(;e!==null&&(e.f&dt)===0;)e=e.next;return e}function nc(e,t,n,r,i){var Q,ve,ne,fe,Ce,he,oe,je,de;var s=(r&qo)!==0,o=t.length,l=e.items,c=Qn(e.effect.first),u,d=null,p,f=[],h=[],m,b,_,E;if(s)for(E=0;E<o;E+=1)m=t[E],b=i(m,E),_=l.get(b).e,(_.f&$t)===0&&((ve=(Q=_.nodes)==null?void 0:Q.a)==null||ve.measure(),(p??(p=new Set)).add(_));for(E=0;E<o;E+=1){if(m=t[E],b=i(m,E),_=l.get(b).e,e.outrogroups!==null)for(const Se of e.outrogroups)Se.pending.delete(_),Se.done.delete(_);if((_.f&We)!==0&&(Ur(_),s&&((fe=(ne=_.nodes)==null?void 0:ne.a)==null||fe.unfix(),(p??(p=new Set)).delete(_))),(_.f&$t)!==0)if(_.f^=$t,_===c)ir(_,null,n);else{var $=d?d.next:c;_===e.effect.last&&(e.effect.last=_.prev),_.prev&&(_.prev.next=_.next),_.next&&(_.next.prev=_.prev),Jt(e,d,_),Jt(e,_,$),ir(_,$,n),d=_,f=[],h=[],c=Qn(d.next);continue}if(_!==c){if(u!==void 0&&u.has(_)){if(f.length<h.length){var C=h[0],G;d=C.prev;var S=f[0],k=f[f.length-1];for(G=0;G<f.length;G+=1)ir(f[G],C,n);for(G=0;G<h.length;G+=1)u.delete(h[G]);Jt(e,S.prev,k.next),Jt(e,d,S),Jt(e,k,C),c=C,d=k,E-=1,f=[],h=[]}else u.delete(_),ir(_,c,n),Jt(e,_.prev,_.next),Jt(e,_,d===null?e.effect.first:d.next),Jt(e,d,_),d=_;continue}for(f=[],h=[];c!==null&&c!==_;)(u??(u=new Set)).add(c),h.push(c),c=Qn(c.next);if(c===null)continue}(_.f&$t)===0&&f.push(_),d=_,c=Qn(_.next)}if(e.outrogroups!==null){for(const Se of e.outrogroups)Se.pending.size===0&&(Ti(e,Br(Se.done)),(Ce=e.outrogroups)==null||Ce.delete(Se));e.outrogroups.size===0&&(e.outrogroups=null)}if(c!==null||u!==void 0){var T=[];if(u!==void 0)for(_ of u)(_.f&We)===0&&T.push(_);for(;c!==null;)(c.f&We)===0&&c!==e.fallback&&T.push(c),c=Qn(c.next);var V=T.length;if(V>0){var q=(r&Hs)!==0&&o===0?n:null;if(s){for(E=0;E<V;E+=1)(oe=(he=T[E].nodes)==null?void 0:he.a)==null||oe.measure();for(E=0;E<V;E+=1)(de=(je=T[E].nodes)==null?void 0:je.a)==null||de.fix()}tc(e,T,q)}}s&&jt(()=>{var Se,Pe;if(p!==void 0)for(_ of p)(Pe=(Se=_.nodes)==null?void 0:Se.a)==null||Pe.apply()})}function rc(e,t,n,r,i,s,o,l){var c=(o&jo)!==0?(o&Ho)===0?R(n,!1,!1):gn(n):null,u=(o&Vo)!==0?gn(i):null;return{v:c,i:u,e:Ze(()=>(s(t,c??n,u??i,l),()=>{e.delete(r)}))}}function ir(e,t,n){if(e.nodes)for(var r=e.nodes.start,i=e.nodes.end,s=t&&(t.f&$t)===0?t.nodes.start:n;r!==null;){var o=gr(r);if(s.before(r),r===i)return;r=o}}function Jt(e,t,n){t===null?e.effect.first=n:t.next=n,n===null?e.effect.last=t:n.prev=t}function xe(e,t,...n){var r=new Hi(e);wr(()=>{const i=t()??null;r.ensure(i,i&&(s=>i(s,...n)))},nn)}function ic(e,t,n,r,i,s){var o=null,l=e,c=new Hi(l,!1);wr(()=>{const u=t()||null;var d=Zo;if(u===null){c.ensure(null,null);return}return c.ensure(u,p=>{if(u){if(o=va(u,d),Vn(o,o),r){var f=null,h=o.appendChild(It());r(o,h),f==null||f.remove()}B.nodes.end=o,p.before(o)}}),()=>{}},nn),yr(()=>{})}function sc(e,t){var n=void 0,r;ma(()=>{n!==(n=t())&&(r&&(Fe(r),r=null),n&&(r=Ze(()=>{ji(()=>n(e))})))})}function Ma(e){var t,n,r="";if(typeof e=="string"||typeof e=="number")r+=e;else if(typeof e=="object")if(Array.isArray(e)){var i=e.length;for(t=0;t<i;t++)e[t]&&(n=Ma(e[t]))&&(r&&(r+=" "),r+=n)}else for(n in e)e[n]&&(r&&(r+=" "),r+=n);return r}function ac(){for(var e,t,n=0,r="",i=arguments.length;n<i;n++)(e=arguments[n])&&(t=Ma(e))&&(r&&(r+=" "),r+=t);return r}function oc(e){return typeof e=="object"?ac(e):e??""}const _s=[...`
\r\f \v\uFEFF`];function lc(e,t,n){var r=e==null?"":""+e;if(t&&(r=r?r+" "+t:t),n){for(var i of Object.keys(n))if(n[i])r=r?r+" "+i:i;else if(r.length)for(var s=i.length,o=0;(o=r.indexOf(i,o))>=0;){var l=o+s;(o===0||_s.includes(r[o-1]))&&(l===r.length||_s.includes(r[l]))?r=(o===0?"":r.substring(0,o))+r.substring(l+1):o=l}}return r===""?null:r}function gs(e,t=!1){var n=t?" !important;":";",r="";for(var i of Object.keys(e)){var s=e[i];s!=null&&s!==""&&(r+=" "+i+": "+s+n)}return r}function oi(e){return e[0]!=="-"||e[1]!=="-"?e.toLowerCase():e}function cc(e,t){if(t){var n="",r,i;if(Array.isArray(t)?(r=t[0],i=t[1]):r=t,e){e=String(e).replaceAll(/\s*\/\*.*?\*\/\s*/g,"").trim();var s=!1,o=0,l=!1,c=[];r&&c.push(...Object.keys(r).map(oi)),i&&c.push(...Object.keys(i).map(oi));var u=0,d=-1;const b=e.length;for(var p=0;p<b;p++){var f=e[p];if(l?f==="/"&&e[p-1]==="*"&&(l=!1):s?s===f&&(s=!1):f==="/"&&e[p+1]==="*"?l=!0:f==='"'||f==="'"?s=f:f==="("?o++:f===")"&&o--,!l&&s===!1&&o===0){if(f===":"&&d===-1)d=p;else if(f===";"||p===b-1){if(d!==-1){var h=oi(e.substring(u,d).trim());if(!c.includes(h)){f!==";"&&p++;var m=e.substring(u,p).trim();n+=" "+m+";"}}u=p+1,d=-1}}}}return r&&(n+=gs(r)),i&&(n+=gs(i,!0)),n=n.trim(),n===""?null:n}return e==null?null:String(e)}function Wi(e,t,n,r,i,s){var o=e[_i];if(o!==n||o===void 0){var l=lc(n,r,s);l==null?e.removeAttribute("class"):t?e.className=l:e.setAttribute("class",l),e[_i]=n}else if(s&&i!==s)for(var c in s){var u=!!s[c];(i==null||u!==!!i[c])&&e.classList.toggle(c,u)}return s}function li(e,t={},n,r){for(var i in n){var s=n[i];t[i]!==s&&(n[i]==null?e.style.removeProperty(i):e.style.setProperty(i,s,r))}}function Ca(e,t,n,r){var i=e[gi];if(i!==t){var s=cc(t,r);s==null?e.removeAttribute("style"):e.style.cssText=s,e[gi]=t}else r&&(Array.isArray(r)?(li(e,n==null?void 0:n[0],r[0]),li(e,n==null?void 0:n[1],r[1],"important")):li(e,n,r));return r}function Fr(e,t,n=!1){if(e.multiple){if(t==null)return;if(!hr(t))return tl();for(var r of e.options)r.selected=t.includes(ys(r));return}for(r of e.options){var i=ys(r);if($l(i,t)){r.selected=!0;return}}(!n||t!==void 0)&&(e.selectedIndex=-1)}function Pa(e){var t=new MutationObserver(()=>{Fr(e,e.__value)});t.observe(e,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["value"]}),yr(()=>{t.disconnect()})}function ys(e){return"__value"in e?e.__value:e.value}const Zn=Symbol("class"),Xn=Symbol("style"),Oa=Symbol("is custom element"),Da=Symbol("is html"),uc=Wr?"input":"INPUT",fc=Wr?"option":"OPTION",dc=Wr?"select":"SELECT",vc=Wr?"progress":"PROGRESS";function Ra(e,t){var n=Kr(e);n.value===(n.value=t??void 0)||e.value===t&&(t!==0||e.nodeName!==vc)||(e.value=t??"")}function hc(e,t){var n=Kr(e);n.checked!==(n.checked=t??void 0)&&(e.checked=t)}function pc(e,t){t?e.hasAttribute("selected")||e.setAttribute("selected",""):e.removeAttribute("selected")}function ge(e,t,n,r){var i=Kr(e);i[t]!==(i[t]=n)&&(t==="loading"&&(e[To]=n),n==null?e.removeAttribute(t):typeof n!="string"&&La(e).includes(t)?e[t]=n:e.setAttribute(t,n))}function mc(e,t,n,r,i=!1,s=!1){var o=Kr(e),l=o[Oa],c=!o[Da],u=t||{},d=e.nodeName===fc;for(var p in t)p in n||(n[p]=null);n.class?n.class=oc(n.class):n[Zn]&&(n.class=null),n[Xn]&&(n.style??(n.style=null));var f=La(e);if(e.nodeName===uc&&"type"in n&&("value"in n||"__value"in n)){var h=n.type;(h!==u.type||h===void 0&&e.hasAttribute("type"))&&(u.type=h,ge(e,"type",h))}for(const S in n){let k=n[S];if(d&&S==="value"&&k==null){e.value=e.__value="",u[S]=k;continue}if(S==="class"){var m=e.namespaceURI==="http://www.w3.org/1999/xhtml";Wi(e,m,k,r,t==null?void 0:t[Zn],n[Zn]),u[S]=k,u[Zn]=n[Zn];continue}if(S==="style"){Ca(e,k,t==null?void 0:t[Xn],n[Xn]),u[S]=k,u[Xn]=n[Xn];continue}var b=u[S];if(!(k===b&&!(k===void 0&&e.hasAttribute(S)))){u[S]=k;var _=S[0]+S[1];if(_!=="$$")if(_==="on"){const T={},V="$$"+S;let q=S.slice(2);var E=Vl(q);if(Fl(q)&&(q=q.slice(0,-7),T.capture=!0),!E&&b){if(k!=null)continue;e.removeEventListener(q,u[V],T),u[V]=null}if(E)Kl(q,e,k),Gl([q]);else if(k!=null){let Q=function(ve){u[S].call(this,ve)};var G=Q;u[V]=Ta(q,e,Q,T)}}else if(S==="style")ge(e,S,k);else if(S==="autofocus")cl(e,!!k);else if(!l&&(S==="__value"||S==="value"&&k!=null))e.value=e.__value=k;else if(S==="selected"&&d)pc(e,k);else{var $=S;c||($=Hl($));var C=$==="defaultValue"||$==="defaultChecked";if(k==null&&!l&&!C)if(o[S]=null,$==="value"||$==="checked"){let T=e;const V=t===void 0;if($==="value"){let q=T.defaultValue;T.removeAttribute($),T.defaultValue=q,T.value=T.__value=V?q:null}else{let q=T.defaultChecked;T.removeAttribute($),T.defaultChecked=q,T.checked=V?q:!1}}else e.removeAttribute(S);else C||f.includes($)&&(l||typeof k!="string")?(e[$]=k,$ in o&&(o[$]=Ne)):typeof k!="function"&&ge(e,$,k)}}}return u}function bs(e,t,n=[],r=[],i=[],s,o=!1,l=!1){Zs(i,n,r,c=>{var u=void 0,d={},p=e.nodeName===dc,f=!1;if(ma(()=>{var m=t(...c.map(a)),b=mc(e,u,m,s,o,l);f&&p&&"value"in m&&Fr(e,m.value);for(let E of Object.getOwnPropertySymbols(d))m[E]||Fe(d[E]);for(let E of Object.getOwnPropertySymbols(m)){var _=m[E];E.description===Xo&&(!u||_!==u[E])&&(d[E]&&Fe(d[E]),d[E]=Ze(()=>sc(e,()=>_))),b[E]=_}u=b}),p){var h=e;ji(()=>{Fr(h,u.value,!0),Pa(h)})}f=!0})}function Kr(e){return e[Ar]??(e[Ar]={[Oa]:e.nodeName.includes("-"),[Da]:e.namespaceURI===Bs})}var ws=new Map;function La(e){var t=e.getAttribute("is")||e.nodeName,n=ws.get(t);if(n)return n;ws.set(t,n=[]);for(var r,i=e,s=Element.prototype;s!==i;){r=Us(i);for(var o in r)r[o].set&&o!=="innerHTML"&&o!=="textContent"&&o!=="innerText"&&n.push(o);i=Oi(i)}return n}function Pr(e,t,n=t){var r=new WeakSet;fl(e,"input",async i=>{var s=i?e.defaultValue:e.value;if(s=ci(e)?ui(s):s,n(s),D!==null&&r.add(D),await Ul(),s!==(s=t())){var o=e.selectionStart,l=e.selectionEnd,c=e.value.length;if(e.value=s??"",l!==null){var u=e.value.length;o===l&&l===c&&u>c?(e.selectionStart=u,e.selectionEnd=u):(e.selectionStart=o,e.selectionEnd=Math.min(l,u))}}}),M(t)==null&&e.value&&(n(ci(e)?ui(e.value):e.value),D!==null&&r.add(D)),br(()=>{var i=t();if(e===document.activeElement){var s=D;if(r.has(s))return}ci(e)&&i===ui(e.value)||e.type==="date"&&!i&&!e.value||i!==e.value&&(e.value=i??"")})}function ci(e){var t=e.type;return t==="number"||t==="range"}function ui(e){return e===""?null:+e}function Ii(e,t,n){var r=Ft(e,t);r&&r.set&&(e[t]=n,yr(()=>{e[t]=null}))}function fi(e,t){return e===t||(e==null?void 0:e[Tt])===t}function jr(e={},t,n,r){var i=le.r,s=B;return ji(()=>{var o,l;return br(()=>{o=l,l=[],M(()=>{fi(n(...l),e)||(t(e,...l),o&&fi(n(...o),e)&&t(null,...o))})}),()=>{let c=s;for(;c!==i&&c.parent!==null&&c.parent.f&mi;)c=c.parent;const u=()=>{l&&fi(n(...l),e)&&t(null,...l)},d=c.teardown;c.teardown=()=>{u(),d==null||d()}}}),e}function _c(e){return function(...t){var n=t[0];return n.stopPropagation(),e==null?void 0:e.apply(this,t)}}function gc(e){return function(...t){var n=t[0];return n.preventDefault(),e==null?void 0:e.apply(this,t)}}function Bt(e=!1){const t=le,n=t.l.u;if(!n)return;let r=()=>we(t.s);if(e){let i=0,s={};const o=Un(()=>{let l=!1;const c=t.s;for(const u in c)c[u]!==s[u]&&(s[u]=c[u],l=!0);return l&&i++,i});r=()=>a(o)}n.b.length&&Cl(()=>{xs(t,r),hi(n.b)}),ki(()=>{const i=M(()=>n.m.map(No));return()=>{for(const s of i)typeof s=="function"&&s()}}),n.a.length&&ki(()=>{xs(t,r),hi(n.a)})}function xs(e,t){if(e.l.s)for(const n of e.l.s)a(n);t()}function za(e,t){var s;var n=(s=e.$$events)==null?void 0:s[t.type],r=hr(n)?n.slice():n==null?[]:[n];for(var i of r)i.call(this,t)}const yc={get(e,t){if(!e.exclude.has(t))return e.props[t]},set(e,t){return!1},getOwnPropertyDescriptor(e,t){if(!e.exclude.has(t)&&t in e.props)return{enumerable:!0,configurable:!0,value:e.props[t]}},has(e,t){return e.exclude.has(t)?!1:t in e.props},ownKeys(e){return Reflect.ownKeys(e.props).filter(t=>!e.exclude.has(t))}};function Ee(e,t,n){return new Proxy({props:e,exclude:t},yc)}const bc={get(e,t){let n=e.props.length;for(;n--;){let r=e.props[n];if(Jn(r)&&(r=r()),typeof r=="object"&&r!==null&&t in r)return r[t]}},set(e,t,n){let r=e.props.length;for(;r--;){let i=e.props[r];Jn(i)&&(i=i());const s=Ft(i,t);if(s&&s.set)return s.set(n),!0}return!1},getOwnPropertyDescriptor(e,t){let n=e.props.length;for(;n--;){let r=e.props[n];if(Jn(r)&&(r=r()),typeof r=="object"&&r!==null&&t in r){const i=Ft(r,t);return i&&!i.configurable&&(i.configurable=!0),i}}},has(e,t){if(t===Tt||t===Vs)return!1;for(let n of e.props)if(Jn(n)&&(n=n()),n!=null&&t in n)return!0;return!1},ownKeys(e){const t=[];for(let n of e.props)if(Jn(n)&&(n=n()),!!n){for(const r in n)t.includes(r)||t.push(r);for(const r of Object.getOwnPropertySymbols(n))t.includes(r)||t.push(r)}return t}};function Te(...e){return new Proxy({props:e},bc)}function ae(e,t,n,r){var G;var i=!Bn||(n&Wo)!==0,s=(n&Go)!==0,o=(n&Yo)!==0,l=r,c=!0,u=void 0,d=()=>o&&i?(u??(u=Un(r)),a(u)):(c&&(c=!1,l=o?M(r):r),l);let p;if(s){var f=Tt in e||Vs in e;p=((G=Ft(e,t))==null?void 0:G.set)??(f&&t in e?S=>e[t]=S:void 0)}var h,m=!1;s?[h,m]=ll(()=>e[t]):h=e[t],h===void 0&&r!==void 0&&(h=d(),p&&(i&&Ro(),p(h)));var b;if(i?b=()=>{var S=e[t];return S===void 0?d():(c=!0,S)}:b=()=>{var S=e[t];return S!==void 0&&(l=void 0),S===void 0?l:S},i&&(n&Ko)===0)return b;if(p){var _=e.$$legacy;return(function(S,k){return arguments.length>0?((!i||!k||_||m)&&p(k?b():S),S):b()})}var E=!1,$=((n&Bo)!==0?Un:Ut)(()=>(E=!1,b()));s&&a($);var C=B;return(function(S,k){if(arguments.length>0){const T=k?a($):i&&s?An(S):S;return g($,T),E=!0,l!==void 0&&(l=T),S}return Ht&&E||(C.f&nt)!==0?$.v:a($)})}function Ua(e){le===null&&qs(),Bn&&le.l!==null?xc(le).m.push(e):ki(()=>{const t=M(e);if(typeof t=="function")return t})}function wc(e,t,{bubbles:n=!1,cancelable:r=!1}={}){return new CustomEvent(e,{detail:t,bubbles:n,cancelable:r})}function Gr(){const e=le;return e===null&&qs(),(t,n,r)=>{var s;const i=(s=e.s.$$events)==null?void 0:s[t];if(i){const o=hr(i)?i.slice():[i],l=wc(t,n,r);for(const c of o)c.call(e.x,l);return!l.defaultPrevented}return!0}}function xc(e){var t=e.l;return t.u??(t.u={a:[],b:[],m:[]})}const Ec="modulepreload",Sc=function(e){return"/"+e},Es={},kc=function(t,n,r){let i=Promise.resolve();if(n&&n.length>0){let o=function(u){return Promise.all(u.map(d=>Promise.resolve(d).then(p=>({status:"fulfilled",value:p}),p=>({status:"rejected",reason:p}))))};document.getElementsByTagName("link");const l=document.querySelector("meta[property=csp-nonce]"),c=(l==null?void 0:l.nonce)||(l==null?void 0:l.getAttribute("nonce"));i=o(n.map(u=>{if(u=Sc(u),u in Es)return;Es[u]=!0;const d=u.endsWith(".css"),p=d?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${u}"]${p}`))return;const f=document.createElement("link");if(f.rel=d?"stylesheet":Ec,d||(f.as="script"),f.crossOrigin="",f.href=u,c&&f.setAttribute("nonce",c),document.head.appendChild(f),d)return new Promise((h,m)=>{f.addEventListener("load",h),f.addEventListener("error",()=>m(new Error(`Unable to preload CSS for ${u}`)))})}))}function s(o){const l=new Event("vite:preloadError",{cancelable:!0});if(l.payload=o,window.dispatchEvent(l),!l.defaultPrevented)throw o}return i.then(o=>{for(const l of o||[])l.status==="rejected"&&s(l.reason);return t().catch(s)})},Nc="5";var Ls;typeof window<"u"&&((Ls=window.__svelte??(window.__svelte={})).v??(Ls.v=new Set)).add(Nc);sl();/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */const Ac={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var $c=new Set(["$$slots","$$events","$$legacy","name","color","size","strokeWidth","absoluteStrokeWidth","iconNode","children"]),Tc=Ql("<svg><!><!></svg>");function Ie(e,t){ee(t,!0);const n=ae(t,"color",3,"currentColor"),r=ae(t,"size",3,24),i=ae(t,"strokeWidth",3,2),s=ae(t,"absoluteStrokeWidth",3,!1),o=ae(t,"iconNode",19,()=>[]),l=Ee(t,$c);var c=Tc();bs(c,p=>({...Ac,...l,width:r(),height:r(),stroke:n(),"stroke-width":p,class:["lucide-icon lucide",t.name&&`lucide-${t.name}`,t.class]}),[()=>s()?Number(i())*24/Number(r()):i()]);var u=x(c);Gn(u,17,o,Bi,(p,f)=>{var h=kn(()=>Ao(a(f),2));let m=()=>a(h)[0],b=()=>a(h)[1];var _=ce(),E=J(_);ic(E,m,!0,($,C)=>{bs($,()=>({...b()}))}),N(p,_)});var d=A(u);xe(d,()=>t.children??be),N(e,c),te()}var Ic=new Set(["$$slots","$$events","$$legacy"]);function Mc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Ic);const r=[["path",{d:"M20 6 9 17l-5-5"}]];Ie(e,Te({name:"check"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Cc=new Set(["$$slots","$$events","$$legacy"]);function Pc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Cc);const r=[["path",{d:"m2 2 20 20"}],["path",{d:"M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"}],["path",{d:"M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"}]];Ie(e,Te({name:"cloud-off"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Oc=new Set(["$$slots","$$events","$$legacy"]);function Fa(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Oc);const r=[["path",{d:"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"}]];Ie(e,Te({name:"cloud"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Dc=new Set(["$$slots","$$events","$$legacy"]);function ja(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Dc);const r=[["path",{d:"M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"}]];Ie(e,Te({name:"command"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Rc=new Set(["$$slots","$$events","$$legacy"]);function Lc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Rc);const r=[["path",{d:"M20 4v7a4 4 0 0 1-4 4H4"}],["path",{d:"m9 10-5 5 5 5"}]];Ie(e,Te({name:"corner-down-left"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var zc=new Set(["$$slots","$$events","$$legacy"]);function Ss(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,zc);const r=[["path",{d:"M15 3h6v6"}],["path",{d:"M10 14 21 3"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"}]];Ie(e,Te({name:"external-link"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Uc=new Set(["$$slots","$$events","$$legacy"]);function Fc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Uc);const r=[["path",{d:"M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"}],["path",{d:"M6.453 15h11.094"}],["path",{d:"M8.5 2h7"}]];Ie(e,Te({name:"flask-conical"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var jc=new Set(["$$slots","$$events","$$legacy"]);function Vc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,jc);const r=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2"}],["circle",{cx:"9",cy:"9",r:"2"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]];Ie(e,Te({name:"image"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var qc=new Set(["$$slots","$$events","$$legacy"]);function Yr(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,qc);const r=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56"}]];Ie(e,Te({name:"loader-circle"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Hc=new Set(["$$slots","$$events","$$legacy"]);function Bc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Hc);const r=[["path",{d:"m16 17 5-5-5-5"}],["path",{d:"M21 12H9"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}]];Ie(e,Te({name:"log-out"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Wc=new Set(["$$slots","$$events","$$legacy"]);function Kc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Wc);const r=[["path",{d:"M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"}],["path",{d:"M10 19v-3.96 3.15"}],["path",{d:"M7 19h5"}],["rect",{width:"6",height:"10",x:"16",y:"12",rx:"2"}]];Ie(e,Te({name:"monitor-smartphone"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Gc=new Set(["$$slots","$$events","$$legacy"]);function Yc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Gc);const r=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"}]];Ie(e,Te({name:"moon"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Jc=new Set(["$$slots","$$events","$$legacy"]);function Qc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Jc);const r=[["path",{d:"M5 12h14"}],["path",{d:"M12 5v14"}]];Ie(e,Te({name:"plus"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var Zc=new Set(["$$slots","$$events","$$legacy"]);function Xc(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,Zc);const r=[["path",{d:"m13.5 8.5-5 5"}],["path",{d:"m8.5 8.5 5 5"}],["circle",{cx:"11",cy:"11",r:"8"}],["path",{d:"m21 21-4.3-4.3"}]];Ie(e,Te({name:"search-x"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var eu=new Set(["$$slots","$$events","$$legacy"]);function tu(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,eu);const r=[["path",{d:"m21 21-4.34-4.34"}],["circle",{cx:"11",cy:"11",r:"8"}]];Ie(e,Te({name:"search"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var nu=new Set(["$$slots","$$events","$$legacy"]);function ru(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,nu);const r=[["path",{d:"M14 17H5"}],["path",{d:"M19 7h-9"}],["circle",{cx:"17",cy:"17",r:"3"}],["circle",{cx:"7",cy:"7",r:"3"}]];Ie(e,Te({name:"settings-2"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var iu=new Set(["$$slots","$$events","$$legacy"]);function Ki(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,iu);const r=[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"}],["path",{d:"M20 2v4"}],["path",{d:"M22 4h-4"}],["circle",{cx:"4",cy:"20",r:"2"}]];Ie(e,Te({name:"sparkles"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var su=new Set(["$$slots","$$events","$$legacy"]);function au(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,su);const r=[["path",{d:"M10 11v6"}],["path",{d:"M14 11v6"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{d:"M3 6h18"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]];Ie(e,Te({name:"trash-2"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var ou=new Set(["$$slots","$$events","$$legacy"]);function lu(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,ou);const r=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{d:"M12 9v4"}],["path",{d:"M12 17h.01"}]];Ie(e,Te({name:"triangle-alert"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}var cu=new Set(["$$slots","$$events","$$legacy"]);function Jr(e,t){ee(t,!0);/**
 * @license @lucide/svelte v0.544.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The MIT License (MIT) (for portions derived from Feather)
 *
 * Copyright (c) 2013-2023 Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */let n=Ee(t,cu);const r=[["path",{d:"M18 6 6 18"}],["path",{d:"m6 6 12 12"}]];Ie(e,Te({name:"x"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ce(),l=J(o);xe(l,()=>t.children??be),N(i,o)},$$slots:{default:!0}})),te()}function Gi(e){const t=e.search(/\s/);return t<0?{title:e.trim(),body:"",hasBodySeparator:!1}:{title:e.slice(0,t).trim(),body:e.slice(t+1).replace(/^\s+/,"").trimEnd(),hasBodySeparator:!0}}function Va(e){return e.isComposing||e.keyCode===229}function pn(e){return e.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g," ").trim()}function qa(e,t){const n=pn(t),r=e.split(/\r?\n/).map(i=>i.trim()).filter(Boolean);return n?r.find(i=>pn(i).includes(n))??r[0]??"":r[0]??""}function Mi(e,t,n,r=180){const i=`${e}
${t}`.trim(),s=qa(i,n)||i;return s.length<=r?s:`${s.slice(0,r).trimEnd()}…`}function ks(e,t=2){const n=pn(e).replace(/\s/g,""),r=new Map;if(n.length<t)return n&&r.set(n,1),r;for(let i=0;i<=n.length-t;i+=1){const s=n.slice(i,i+t);r.set(s,(r.get(s)??0)+1)}return r}function uu(e,t){if(e.size===0||t.size===0)return 0;let n=0,r=0,i=0;for(const s of e.values())r+=s*s;for(const s of t.values())i+=s*s;for(const[s,o]of e)n+=o*(t.get(s)??0);return r===0||i===0?0:n/(Math.sqrt(r)*Math.sqrt(i))}function fu(e,t){const n=new Map;return e.forEach((r,i)=>{n.set(r.note.id,{...r,lexicalRank:i+1,score:di(i+1,1)})}),t.forEach((r,i)=>{const s=n.get(r.note.id);if(s){n.set(r.note.id,{...s,matchType:"both",semanticRank:i+1,score:s.score+di(i+1,.72)});return}n.set(r.note.id,{...r,semanticRank:i+1,score:di(i+1,.72)})}),[...n.values()].sort((r,i)=>i.score-r.score)}function di(e,t){return t/(60+e)}function Ns(e,t=Date.now()){const n=Math.max(0,Math.floor((t-e)/1e3));return n<45?"刚刚":n<3600?`${Math.floor(n/60)} 分钟前`:n<86400?`${Math.floor(n/3600)} 小时前`:n<604800?`${Math.floor(n/86400)} 天前`:new Intl.DateTimeFormat("zh-CN",{month:"short",day:"numeric",year:new Date(e).getFullYear()===new Date(t).getFullYear()?void 0:"numeric"}).format(e)}const Yi="notesflash.connection.v1";class Vt extends Error{constructor(t,n,r,i){super(t),this.status=n,this.code=r,this.payload=i,this.name="ApiError"}}function du(){try{const e=localStorage.getItem(Yi);return e?JSON.parse(e):null}catch{return null}}function vu(e){localStorage.setItem(Yi,JSON.stringify(e))}function hu(){localStorage.removeItem(Yi)}async function pu(e,t,n){const r=yu(e),i=await fetch(`${r}/api/devices/pair`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:t.trim(),deviceName:n,platform:bu()})}),s=await Ha(i);if(!i.ok)throw Ba(i,s);const o=s,l=o.token??o.accessToken;if(!l||!o.instanceId)throw new Vt("配对响应缺少必要字段。",500,"INVALID_PAIRING_RESPONSE",s);return{endpoint:r,token:l,instanceId:o.instanceId,deviceId:o.deviceId}}class As{constructor(t){this.connection=t}async logout(){const t=new AbortController,n=window.setTimeout(()=>t.abort(),4e3);try{await this.request("/api/auth/logout",{method:"POST",signal:t.signal})}finally{window.clearTimeout(n)}}async listNotes(t,n){const r=[];let i=0;for(let s=0;s<1e3;s+=1){const o=await this.request(`/api/notes?sort=${encodeURIComponent(t)}&limit=100&offset=${i}`),l=Array.isArray(o)?o:$s(o,"notes");r.push(...l.map(u=>this.mapNote(u))),n==null||n([...r]);const c=Nr(en(o).nextOffset);if(c===void 0||c<=i||l.length===0)break;i=c}return r}async createNote(t){const n=await this.request("/api/notes",{method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(t)});return this.mapNote(vi(n,"note"))}async updateNote(t,n){const r=await this.request(`/api/notes/${encodeURIComponent(t)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(n)});return this.mapNote(vi(r,"note"))}async deleteNote(t,n){await this.request(`/api/notes/${encodeURIComponent(t)}?baseVersion=${n}`,{method:"DELETE"})}async lexicalSearch(t){const n=await this.request(`/api/search/lexical?q=${encodeURIComponent(t)}`);return this.mapHits(n,"lexical")}async semanticSearch(t){const n=await this.request("/api/search/semantic",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:t,limit:30})});return this.mapHits(n,"semantic")}async uploadImage(t){const n=new FormData;n.set("file",t);const r=await this.request("/api/images",{method:"POST",body:n});return this.mapImage(vi(r,"image"))}async request(t,n={}){const r=new Headers(n.headers);r.set("authorization",`Bearer ${this.connection.token}`),r.set("accept","application/json");const i=await fetch(`${this.connection.endpoint}${t}`,{...n,headers:r,cache:"no-store"}),s=await Ha(i);if(!i.ok)throw Ba(i,s);return s}mapHits(t,n){return(Array.isArray(t)?t:$s(t,"results")).map((i,s)=>{const o=en(i),l=this.mapNote(o.note??o);return{note:l,matchType:o.matchType==="both"?"both":n,snippet:typeof o.snippet=="string"?o.snippet:Mi(l.title,l.body,""),score:Ts(o.score,1/(s+1))}})}mapNote(t){const n=en(t),r=Array.isArray(n.images)?n.images:[];return{id:Ot(n.id),title:Ot(n.title),body:Ot(n.body??n.content),images:r.map(i=>this.mapImage(i)),version:Ts(n.version,1),createdAt:Is(n.createdAt??n.created_at),updatedAt:Is(n.updatedAt??n.updated_at),embeddingStatus:wu(n.embeddingStatus??n.embedding_status)}}mapImage(t){const n=en(t),r=Ot(n.url??n.objectUrl??n.object_url);return{id:Ot(n.id),url:r.startsWith("/")?`${this.connection.endpoint}${r}`:r,name:Ot(n.name??n.filename,"图片"),mimeType:Ot(n.mimeType??n.mime_type,"image/*"),width:Nr(n.width),height:Nr(n.height),size:Nr(n.size)}}}class mu{constructor(){qe(this,"notes",_u());qe(this,"images",new Map);for(const t of this.notes)for(const n of t.images)this.images.set(n.id,n)}async logout(){}async listNotes(t,n){const r=gu(this.notes.map(En),t);return n==null||n(r),r}async createNote(t){const n=Date.now(),r={id:crypto.randomUUID(),title:t.title,body:t.body,images:(t.imageIds??[]).map(i=>this.images.get(i)).filter(Ms),version:1,createdAt:n,updatedAt:n,embeddingStatus:"pending"};return this.notes.unshift(r),window.setTimeout(()=>{const i=this.notes.find(s=>s.id===r.id);i&&(i.embeddingStatus="ready")},900),En(r)}async updateNote(t,n){const r=this.notes.find(i=>i.id===t);if(!r)throw new Vt("找不到这条笔记。",404,"NOTE_NOT_FOUND");if(r.version!==n.baseVersion)throw new Vt("这条笔记已经在另一处被修改。",409,"VERSION_CONFLICT",{serverNote:En(r)});return r.title=n.title,r.body=n.body,r.images=(n.imageIds??[]).map(i=>this.images.get(i)).filter(Ms),r.version+=1,r.updatedAt=Date.now(),r.embeddingStatus="pending",window.setTimeout(()=>{const i=this.notes.find(s=>s.id===t);i&&i.version===r.version&&(i.embeddingStatus="ready")},900),En(r)}async deleteNote(t,n){const r=this.notes.find(i=>i.id===t);if(r){if(r.version!==n)throw new Vt("版本冲突。",409,"VERSION_CONFLICT");this.notes=this.notes.filter(i=>i.id!==t)}}async lexicalSearch(t){const n=pn(t);if(!n)return[];const r=[];for(const i of this.notes){const s=pn(i.title),o=pn(i.body),l=s.indexOf(n),c=o.indexOf(n);if(l<0&&c<0)continue;const u=(s===n?100:0)+(l===0?60:l>=0?35:0)+(c>=0?20:0)+Math.max(0,8-Math.floor((Date.now()-i.updatedAt)/864e5));r.push({note:En(i),matchType:"lexical",snippet:Mi(i.title,i.body,t),score:u})}return r.sort((i,s)=>s.score-i.score)}async semanticSearch(t){const n=ks(t);return await xu(180),this.notes.map(r=>{const i=uu(n,ks(`${r.title} ${r.body}`));return{note:En(r),matchType:"semantic",snippet:Mi(r.title,r.body,t),score:i}}).filter(r=>r.score>.08).sort((r,i)=>i.score-r.score).slice(0,20)}async uploadImage(t){const[n,r]=await Promise.all([Eu(t),Su(t)]),i={id:crypto.randomUUID(),url:r,name:t.name,mimeType:t.type,size:t.size,...n};return this.images.set(i.id,i),i}}function _u(){const e=Date.now(),t={id:"demo-image-layout",url:"/icons/notesflash-512.png",name:"NotesFlash 图标",mimeType:"image/png",width:512,height:512,size:18432};return[{id:crypto.randomUUID(),title:"Cloudflare 后端部署",body:`点击 Deploy to Cloudflare 后，Worker、D1、R2、Vectorize 和 Queue 会在用户自己的账号中创建。
桌面端只需要填写 Worker 地址与配对码。
部署完成后打开 /setup 生成一次性配对码。`,images:[],version:1,createdAt:e-864e5*6,updatedAt:e-1e3*60*42,embeddingStatus:"ready"},{id:crypto.randomUUID(),title:"快捷检索的交互约定",body:`Command + Shift + Space 唤起窗口。搜索框自动聚焦。
方向键切换结果，Tab 复制命中行并进入编辑。
搜索结果第一项始终是快速创建。
Enter 打开当前选中笔记。`,images:[],version:1,createdAt:e-864e5*5,updatedAt:e-1e3*60*60*5,embeddingStatus:"ready"},{id:crypto.randomUUID(),title:"周末采购清单",body:`咖啡豆
燕麦奶
USB-C 线
相框
厨房纸巾`,images:[],version:1,createdAt:e-864e5*4,updatedAt:e-864e5,embeddingStatus:"ready"},{id:crypto.randomUUID(),title:"产品定位一句话",body:`NotesFlash 是一个搜索优先、扁平无文件夹的云端笔记。
桌面负责快速输入，手机 PWA 负责随时回看。
核心不是整理，而是尽快找到那一行。`,images:[],version:1,createdAt:e-864e5*3,updatedAt:e-1e3*60*90,embeddingStatus:"ready"},{id:crypto.randomUUID(),title:"语义搜索校准样例",body:`向量检索会把意思相近的内容排上来。
例如搜索“配对码怎么拿”，可能命中 Cloudflare 部署与设备连接相关笔记。
演示模式用本地 n-gram 近似，真实后端会走 Workers AI + Vectorize。`,images:[],version:1,createdAt:e-864e5*2,updatedAt:e-1e3*60*18,embeddingStatus:"ready"},{id:crypto.randomUUID(),title:"界面截图备忘",body:`主界面保持紧凑：顶部搜索，下方是完整正文流。
不要折叠，不要只显示摘要。
下面这张图用于验收图片展示。`,images:[t],version:1,createdAt:e-864e5,updatedAt:e-1e3*60*8,embeddingStatus:"ready"},{id:crypto.randomUUID(),title:"会议速记：周五同步",body:`1. 确认 PWA 安装路径
2. 校验 Tab 复制命中行
3. 检查快速创建标题来自搜索框
4. 图片粘贴后立刻预览`,images:[],version:1,createdAt:e-1e3*60*60*30,updatedAt:e-1e3*60*3,embeddingStatus:"ready"}]}function gu(e,t){return e.sort((n,r)=>t==="title_asc"?n.title.localeCompare(r.title,"zh-CN"):t==="created_desc"?r.createdAt-n.createdAt:r.updatedAt-n.updatedAt)}function En(e){return{...e,images:e.images.map(t=>({...t}))}}function yu(e){const t=e.trim().replace(/\/+$/,"");if(!/^https?:\/\//i.test(t))throw new Vt("Worker 地址必须以 https:// 开头。",400);return t}function bu(){return"__TAURI_INTERNALS__"in window?"macos":window.matchMedia("(display-mode: standalone)").matches?"pwa":/iPhone|iPad|iPod/i.test(navigator.userAgent)?"ios-web":"web"}async function Ha(e){const t=await e.text();if(!t)return null;try{return JSON.parse(t)}catch{return t}}function Ba(e,t){const n=en(t),r=en(n.error),i=Ot(r.message??n.message,`请求失败（${e.status}）`),s=Ot(r.code??n.code,void 0);return new Vt(i,e.status,s,t)}function $s(e,t){const n=en(e)[t];return Array.isArray(n)?n:[]}function vi(e,t){return en(e)[t]??e}function en(e){return e&&typeof e=="object"?e:{}}function Ot(e,t=""){return typeof e=="string"?e:t}function Ts(e,t=0){return typeof e=="number"&&Number.isFinite(e)?e:t}function Nr(e){return typeof e=="number"&&Number.isFinite(e)?e:void 0}function Is(e){if(typeof e=="number")return e;if(typeof e=="string"){const t=Number(e);if(Number.isFinite(t))return t;const n=Date.parse(e);if(Number.isFinite(n))return n}return Date.now()}function wu(e){return e==="disabled"||e==="pending"||e==="processing"||e==="ready"||e==="failed"?e:"pending"}function Ms(e){return!!e}function xu(e){return new Promise(t=>window.setTimeout(t,e))}function Eu(e){return new Promise(t=>{const n=new Image,r=URL.createObjectURL(e);n.onload=()=>{t({width:n.naturalWidth,height:n.naturalHeight}),URL.revokeObjectURL(r)},n.onerror=()=>{t({}),URL.revokeObjectURL(r)},n.src=r})}function Su(e){return new Promise((t,n)=>{const r=new FileReader;r.onload=()=>t(String(r.result)),r.onerror=()=>n(r.error??new Error("无法读取图片。")),r.readAsDataURL(e)})}var ku=j('<a class="btn btn-ghost btn-sm mb-3 w-full gap-2" target="_blank" rel="noreferrer">生成或恢复一次性配对码 <!></a>'),Nu=j('<div class="alert alert-error py-2 text-sm" role="alert"><span> </span></div>'),Au=j('<main class="app-shell flex items-center justify-center py-8"><section class="surface w-full max-w-lg rounded-box p-5 shadow-sm sm:p-7"><div class="mb-6 flex items-start gap-4"><div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-content"><!></div> <div><h1 class="text-xl font-semibold tracking-[-0.02em]">连接你的 NotesFlash Cloud</h1> <p class="mt-1 text-sm leading-6 text-base-content/58">笔记保存在你自己的 Cloudflare。这个设备只保存连接信息，不缓存正文。</p></div></div> <a class="btn btn-outline mb-5 w-full gap-2" target="_blank" rel="noreferrer"><!> 一键部署到 Cloudflare <!></a> <div class="divider my-4 text-[11px] text-base-content/35">部署完成后配对</div> <!> <form class="space-y-3"><label class="form-control block"><span class="label pb-1.5 text-xs text-base-content/60">Worker 地址</span> <input class="input input-bordered w-full bg-base-100" placeholder="https://notesflash-example.workers.dev" inputmode="url" autocomplete="url" required=""/></label> <div class="grid gap-3 sm:grid-cols-2"><label class="form-control block"><span class="label pb-1.5 text-xs text-base-content/60">一次性配对码</span> <input class="input input-bordered w-full bg-base-100 font-mono uppercase tracking-widest" placeholder="ABCD-1234" autocomplete="one-time-code" required=""/></label> <label class="form-control block"><span class="label pb-1.5 text-xs text-base-content/60">设备名称</span> <input class="input input-bordered w-full bg-base-100" required=""/></label></div> <!> <button class="btn btn-primary mt-2 w-full" type="submit"><!> 连接这个设备</button></form> <button type="button" class="btn btn-ghost mt-3 w-full gap-2 text-base-content/55"><!> 先使用不落盘的演示模式</button></section></main>');function $u(e,t){ee(t,!1);const n=R(),r=Gr(),i="https://deploy.workers.cloudflare.com/?url=https://github.com/realllllty/notesflash/tree/main/cloud";let s=R(f()),o=R(""),l=R(p()),c=R(!1),u=R("");async function d(){g(c,!0),g(u,"");try{r("connected",await pu(a(s),a(o),a(l)))}catch(Z){g(u,Z instanceof Vt||Z instanceof Error?Z.message:"连接失败")}finally{g(c,!1)}}function p(){return"__TAURI_INTERNALS__"in window?"NotesFlash Mac":`NotesFlash ${navigator.userAgent.includes("Mac")?"Mac":navigator.userAgent.includes("iPhone")?"iPhone":"浏览器"}`}function f(){return"__TAURI_INTERNALS__"in window?"":/^https?:$/.test(window.location.protocol)?window.location.origin:""}Be(()=>a(s),()=>{g(n,/^https?:\/\//i.test(a(s).trim())?`${a(s).trim().replace(/\/+$/,"")}/setup`:"")}),bn(),Bt();var h=Au(),m=x(h),b=x(m),_=x(b),E=x(_);Kc(E,{size:23});var $=A(b,2);ge($,"href",i);var C=x($);Fa(C,{size:17});var G=A(C,2);Ss(G,{size:14,class:"opacity-55"});var S=A($,4);{var k=Z=>{var Oe=ku(),L=A(x(Oe));Ss(L,{size:13,class:"opacity-55"}),ue(()=>ge(Oe,"href",a(n))),N(Z,Oe)};ie(S,Z=>{a(n)&&Z(k)})}var T=A(S,2),V=x(T),q=A(x(V),2),Q=A(V,2),ve=x(Q),ne=A(x(ve),2),fe=A(ve,2),Ce=A(x(fe),2),he=A(Q,2);{var oe=Z=>{var Oe=Nu(),L=x(Oe),re=x(L);ue(()=>$e(re,a(u))),N(Z,Oe)};ie(he,Z=>{a(u)&&Z(oe)})}var je=A(he,2),de=x(je);{var Se=Z=>{Yr(Z,{size:17,class:"animate-spin"})};ie(de,Z=>{a(c)&&Z(Se)})}var Pe=A(T,2),rt=x(Pe);Fc(rt,{size:16}),ue(()=>je.disabled=a(c)),Pr(q,()=>a(s),Z=>g(s,Z)),Pr(ne,()=>a(o),Z=>g(o,Z)),Pr(Ce,()=>a(l),Z=>g(l,Z)),Y("submit",T,gc(d)),Y("click",Pe,()=>r("demo")),N(e,h),te()}const Tu=/^\[\[notesflash-image:([A-Za-z0-9_-]+)\]\]$/;function Iu(e){return`[[notesflash-image:${e}]]`}function Ci(e,t){const n=new Map(t.map(l=>[l.id,l])),r=new Set,i=[],s=[],o=()=>{i.push({key:crypto.randomUUID(),type:"text",text:s.join(`
`)}),s.length=0};for(const l of e.split(`
`)){const c=l.match(Tu),u=c?n.get(c[1]):void 0;if(!c||!u){s.push(l);continue}o(),i.push({key:crypto.randomUUID(),type:"image",image:u}),r.add(u.id)}o();for(const l of t)r.has(l.id)||(i.push({key:crypto.randomUUID(),type:"image",image:l}),i.push({key:crypto.randomUUID(),type:"text",text:""}));return i}function Cs(e){return e.map(t=>t.type==="text"?t.text:Iu(t.image.id)).join(`
`)}function Ps(e){return e.flatMap(t=>t.type==="image"?[t.image]:[])}var Mu=j("<mark> </mark>");function Os(e,t){ee(t,!1);const n=R();let r=ae(t,"text",8,""),i=ae(t,"query",8,"");function s(c,u){const d=pn(u);if(!d)return[{value:c,match:!1}];const p=c.normalize("NFKC").toLocaleLowerCase(),f=[];let h=0,m=p.indexOf(d,h);for(;m>=0;)m>h&&f.push({value:c.slice(h,m),match:!1}),f.push({value:c.slice(m,m+u.length),match:!0}),h=m+u.length,m=p.indexOf(d,h);return h<c.length&&f.push({value:c.slice(h),match:!1}),f.length>0?f:[{value:c,match:!1}]}Be(()=>(we(r()),we(i())),()=>{g(n,s(r(),i()))}),bn(),Bt();var o=ce(),l=J(o);Gn(l,1,()=>a(n),Bi,(c,u)=>{var d=ce(),p=J(d);{var f=m=>{var b=Mu(),_=x(b);ue(()=>$e(_,(a(u),M(()=>a(u).value)))),N(m,b)},h=m=>{var b=Tn();ue(()=>$e(b,(a(u),M(()=>a(u).value)))),N(m,b)};ie(p,m=>{a(u),M(()=>a(u).match)?m(f):m(h,-1)})}N(c,d)}),N(e,o),te()}var Cu=j('<button type="button" class="group relative overflow-hidden rounded-box border border-base-300 bg-base-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><img class="aspect-[4/3] h-full w-full object-cover transition duration-150 group-hover:scale-[1.02]" loading="lazy"/></button>'),Pu=j('<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"></div>'),Ou=j('<div class="fixed inset-0 z-50 flex items-center justify-center bg-neutral/80 p-4 backdrop-blur-sm" role="presentation"><button type="button" class="btn btn-circle btn-sm absolute right-4 top-[calc(1rem+var(--safe-top))] border-0 bg-base-100/90" aria-label="关闭图片"><!></button> <button type="button" class="max-h-[88vh] max-w-full" aria-label="保持查看图片"><img class="max-h-[88vh] max-w-full rounded-box object-contain shadow-2xl"/></button></div>'),Du=j("<!> <!>",1);function Ru(e,t){ee(t,!1);let n=ae(t,"images",24,()=>[]),r=R(null);Bt();var i=Du(),s=J(i);{var o=u=>{var d=Pu();Gn(d,5,n,Bi,(p,f)=>{var h=Cu(),m=x(h);ue(()=>{ge(h,"aria-label",(a(f),M(()=>`查看图片 ${a(f).name}`))),ge(m,"src",(a(f),M(()=>a(f).url))),ge(m,"alt",(a(f),M(()=>a(f).name)))}),Y("click",h,()=>g(r,a(f))),N(p,h)}),N(u,d)};ie(s,u=>{we(n()),M(()=>n().length>0)&&u(o)})}var l=A(s,2);{var c=u=>{var d=Ou(),p=x(d),f=x(p);Jr(f,{size:17});var h=A(p,2),m=x(h);ue(()=>{ge(m,"src",(a(r),M(()=>a(r).url))),ge(m,"alt",(a(r),M(()=>a(r).name)))}),Y("click",p,()=>g(r,null)),Y("click",h,_c(function(b){za.call(this,t,b)})),Y("click",d,()=>g(r,null)),Y("keydown",d,b=>b.key==="Escape"&&g(r,null)),N(u,d)};ie(l,u=>{a(r)&&u(c)})}N(e,i),te()}var Lu=j('<span class="inline-flex items-center gap-1 text-primary/75"><!> </span>'),zu=j('<span class="inline-flex items-center gap-1"><!> </span>'),Uu=j('<div class="note-prose min-h-6 cursor-text text-[14px] text-base-content/78" role="button" tabindex="0"><!></div>'),Fu=j('<article><header class="mb-2 flex items-start gap-3"><div class="min-w-0 flex-1 cursor-text text-left" role="button" tabindex="0"><h2 class="break-words text-[15px] font-semibold leading-6 tracking-[-0.01em]"><!></h2> <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-base-content/42"><time> </time> <!> <!></div></div></header> <div></div></article>');function ju(e,t){ee(t,!1);const n=R();let r=ae(t,"hit",8),i=ae(t,"query",8,""),s=ae(t,"selected",8,!1),o=ae(t,"optionIndex",8,0);const l=Gr();Be(()=>we(r()),()=>{g(n,Ci(r().note.body,r().note.images))}),bn(),Bt();var c=Fu();let u;var d=x(c),p=x(d),f=x(p),h=x(f);{let k=Ut(()=>(we(r()),M(()=>r().note.title||"无标题")));Os(h,{get text(){return a(k)},get query(){return i()}})}var m=A(f,2),b=x(m),_=x(b),E=A(b,2);{var $=k=>{var T=Lu(),V=x(T);Ki(V,{size:11});var q=A(V);ue(()=>$e(q,` ${we(r()),M(()=>r().matchType==="both"?"关键词 + 语义":"语义相关")??""}`)),N(k,T)};ie(E,k=>{we(r()),M(()=>r().matchType==="semantic"||r().matchType==="both")&&k($)})}var C=A(E,2);{var G=k=>{var T=zu(),V=x(T);Vc(V,{size:11});var q=A(V);ue(()=>$e(q,` ${we(r()),M(()=>r().note.images.length)??""}`)),N(k,T)};ie(C,k=>{we(r()),M(()=>r().note.images.length>0)&&k(G)})}var S=A(d,2);Gn(S,5,()=>a(n),k=>k.key,(k,T)=>{var V=ce(),q=J(V);{var Q=ne=>{var fe=Uu(),Ce=x(fe);{var he=oe=>{Os(oe,{get text(){return a(T),M(()=>a(T).text)},get query(){return i()}})};ie(Ce,oe=>{a(T),M(()=>a(T).text)&&oe(he)})}ue(()=>ge(fe,"aria-label",(we(r()),M(()=>`编辑 ${r().note.title} 的正文`)))),Y("click",fe,()=>l("edit")),Y("keydown",fe,oe=>(oe.key==="Enter"||oe.key===" ")&&l("edit")),N(ne,fe)},ve=ne=>{{let fe=Ut(()=>(a(T),M(()=>[a(T).image])));Ru(ne,{get images(){return a(fe)}})}};ie(q,ne=>{a(T),M(()=>a(T).type==="text")?ne(Q):(a(T),M(()=>a(T).type==="image")&&ne(ve,1))})}N(k,V)}),ue(k=>{ge(c,"id",`search-option-${o()}`),u=Wi(c,1,"note-card scroll-mt-24 px-3 py-4 sm:px-4 svelte-1ib1l1a",null,u,{selected:s()}),ge(c,"aria-current",s()?"true":void 0),ge(p,"aria-label",(we(r()),M(()=>`编辑 ${r().note.title}`))),$e(_,k)},[()=>(we(Ns),we(r()),M(()=>Ns(r().note.updatedAt)))]),Y("click",p,()=>l("edit")),Y("keydown",p,k=>(k.key==="Enter"||k.key===" ")&&l("edit")),N(e,c),te()}var Vu=j('<span class="inline-flex items-center gap-1"><!> </span>'),qu=j('<span class="inline-flex items-center gap-1 text-error"><!> 保存失败</span>'),Hu=j('<span class="inline-flex items-center gap-1"><!> 已自动保存</span>'),Bu=j('<textarea data-note-body="" class="note-body-input block min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[14px] leading-[1.68] outline-none placeholder:text-base-content/30 focus:outline-none svelte-1cddmxz" aria-label="笔记正文"></textarea>'),Wu=j('<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><figure class="group relative overflow-hidden rounded-box border border-base-300 bg-base-200"><img class="aspect-[4/3] h-full w-full object-cover"/> <button type="button" class="btn btn-circle btn-xs absolute right-2 top-2 border-0 bg-base-100/90 opacity-70 shadow-sm transition hover:opacity-100"><!></button></figure></div>'),Ku=j('<p class="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error"> </p>'),Gu=j('<section class="note-editor relative scroll-mt-24 px-3 py-4 sm:px-4"><button type="button" class="btn btn-ghost btn-xs absolute right-3 top-4 z-10 gap-1 text-error/75 sm:right-4"><!> 删除</button> <header class="mb-2 flex items-start gap-3 pr-14"><div class="min-w-0 flex-1"><input class="note-title-input block w-full bg-transparent text-[15px] font-semibold leading-6 tracking-[-0.01em] outline-none placeholder:text-base-content/35 svelte-1cddmxz" placeholder="标题" aria-label="笔记标题"/> <div class="mt-1 flex items-center gap-2 text-[11px] text-base-content/42"><!></div></div></header> <div class="text-[14px] leading-7 text-base-content/78"></div> <!></section>');function Yu(e,t){ee(t,!1);let n=ae(t,"note",8),r=ae(t,"saveNote",8),i=ae(t,"deleteNote",8),s=ae(t,"uploadImage",8),o=ae(t,"close",8),l=R(n().title),c=R(Ci(n().body,n().images)),u=n().version,d=R(n().id),p=R("saved"),f=R(""),h=R(!1),m,b=0,_=null,E=R();Ua(()=>{S();const I=O=>{a(p)!=="saved"&&(O.preventDefault(),O.returnValue="")};return window.addEventListener("beforeunload",I),()=>{window.clearTimeout(m),window.removeEventListener("beforeunload",I)}});function $(I){g(d,I.id),g(l,I.title),g(c,Ci(I.body,I.images)),u=I.version,b=0,_=null,g(p,"saved"),g(f,"")}function C(){b+=1,g(p,"dirty"),g(f,""),window.clearTimeout(m),m=window.setTimeout(()=>void k(),650)}async function G(){return k()}function S(){window.setTimeout(()=>{var O;const I=(O=a(E))==null?void 0:O.querySelector("textarea[data-note-body]");I==null||I.focus({preventScroll:!0})},0)}async function k(){if(window.clearTimeout(m),_)return await _?a(p)==="dirty"?k():a(p)==="saved":!1;if(a(p)==="saved")return!0;const I=b,O=Ps(a(c)),H={baseVersion:u,title:a(l).trim()||"无标题",body:Cs(a(c)),imageIds:O.map(De=>De.id)};g(p,"saving");const pe=(async()=>{try{return u=(await r()(n().id,H)).version,b===I?g(p,"saved"):g(p,"dirty"),!0}catch(De){return g(p,"error"),g(f,De instanceof Error?De.message:"保存失败"),!1}})();_=pe;const ze=await pe;return _===pe&&(_=null),ze?b!==I?k():!0:!1}function T(I,O){const H=O.currentTarget;g(c,a(c).map(pe=>pe.key===I&&pe.type==="text"?{...pe,text:H.value}:pe)),C()}async function V(I,O){const H=ve(I.clipboardData);if(H.length===0)return;I.preventDefault();const pe=I.currentTarget,ze=a(c).findIndex(Ke=>Ke.key===O&&Ke.type==="text"),De=a(c)[ze];if(ze<0||!De||De.type!=="text")return;const pt=pe.selectionStart??De.text.length,Ve=pe.selectionEnd??pt,St=De.text.slice(0,pt),Wt=De.text.slice(Ve);g(h,!0),g(f,"");try{const Ke=[];for(const it of H)Ke.push(await s()(it));const Ct=[{key:crypto.randomUUID(),type:"text",text:St}];for(const it of Ke)Ct.push({key:crypto.randomUUID(),type:"image",image:it}),Ct.push({key:crypto.randomUUID(),type:"text",text:""});const Yn=Ct[Ct.length-1];Yn.type==="text"&&(Yn.text=Wt),g(c,[...a(c).slice(0,ze),...Ct,...a(c).slice(ze+1)]),C();const xr=Yn.key;window.setTimeout(()=>{var Er;const it=(Er=a(E))==null?void 0:Er.querySelector(`textarea[data-block-key="${xr}"]`);it==null||it.focus({preventScroll:!0}),it==null||it.setSelectionRange(0,0)},0)}catch(Ke){g(p,"error"),g(f,Ke instanceof Error?Ke.message:"图片上传失败")}finally{g(h,!1)}}function q(I){const O=a(c).findIndex(ze=>ze.key===I&&ze.type==="image");if(O<0)return;const H=a(c)[O-1],pe=a(c)[O+1];if((H==null?void 0:H.type)==="text"&&(pe==null?void 0:pe.type)==="text"){const ze=H.text&&pe.text?`
`:"",De={key:H.key,type:"text",text:`${H.text}${ze}${pe.text}`};g(c,[...a(c).slice(0,O-1),De,...a(c).slice(O+2)])}else g(c,a(c).filter(ze=>ze.key!==I));C()}async function Q(){if(window.confirm(`确定删除“${a(l)||"无标题"}”吗？`))try{await i()({...n(),title:a(l),body:Cs(a(c)),images:Ps(a(c)),version:u})}catch(I){g(p,"error"),g(f,I instanceof Error?I.message:"删除失败")}}function ve(I){if(!I)return[];const O=[...I.items].filter(H=>H.kind==="file"&&H.type.startsWith("image/")).map(H=>H.getAsFile()).filter(H=>!!H);return O.length>0?O:[...I.files].filter(H=>H.type.startsWith("image/"))}async function ne(){await k()&&o()()}function fe(I){I.key==="Escape"&&(I.preventDefault(),ne())}Be(()=>(we(n()),a(d)),()=>{n().id!==a(d)&&$(n())}),bn();var Ce={flush:G,focusBody:S};Bt();var he=Gu(),oe=x(he),je=x(oe);au(je,{size:13});var de=A(oe,2),Se=x(de),Pe=x(Se),rt=A(Pe,2),Z=x(rt);{var Oe=I=>{var O=Vu(),H=x(O);Yr(H,{size:12,class:"animate-spin"});var pe=A(H);ue(()=>$e(pe,` ${a(h)?"正在粘贴图片":"保存中"}`)),N(I,O)},L=I=>{var O=qu(),H=x(O);lu(H,{size:12}),N(I,O)},re=I=>{var O=Hu(),H=x(O);Mc(H,{size:12}),N(I,O)};ie(Z,I=>{a(p)==="saving"||a(h)?I(Oe):a(p)==="error"?I(L,1):I(re,-1)})}var Le=A(de,2);Gn(Le,5,()=>a(c),I=>I.key,(I,O)=>{var H=ce(),pe=J(H);{var ze=pt=>{var Ve=Bu();ue(()=>{ge(Ve,"data-block-key",(a(O),M(()=>a(O).key))),Ra(Ve,(a(O),M(()=>a(O).text))),ge(Ve,"placeholder",(a(c),M(()=>a(c).length===1?"写下正文，可直接粘贴图片…":""))),Ve.readOnly=a(h)}),Y("input",Ve,St=>T(a(O).key,St)),Y("paste",Ve,St=>void V(St,a(O).key)),Y("keydown",Ve,fe),N(pt,Ve)},De=pt=>{var Ve=Wu(),St=x(Ve),Wt=x(St),Ke=A(Wt,2),Ct=x(Ke);Jr(Ct,{size:13}),ue(()=>{ge(Wt,"src",(a(O),M(()=>a(O).image.url))),ge(Wt,"alt",(a(O),M(()=>a(O).image.name))),ge(Ke,"aria-label",(a(O),M(()=>`移除图片 ${a(O).image.name}`)))}),Y("click",Ke,()=>q(a(O).key)),N(pt,Ve)};ie(pe,pt=>{a(O),M(()=>a(O).type==="text")?pt(ze):pt(De,-1)})}N(I,H)});var xt=A(Le,2);{var Et=I=>{var O=Ku(),H=x(O);ue(()=>$e(H,a(f))),N(I,O)};ie(xt,I=>{a(f)&&I(Et)})}return jr(he,I=>g(E,I),()=>a(E)),Y("click",oe,Q),Pr(Pe,()=>a(l),I=>g(l,I)),Y("input",Pe,C),Y("keydown",Pe,fe),N(e,he),Ii(t,"flush",G),Ii(t,"focusBody",S),te(Ce)}var Ju=j('<button id="search-option-0" type="button"><span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-content"><!></span> <span class="min-w-0 flex-1"><span class="block text-sm font-medium"> </span> <span class="block truncate text-xs text-base-content/48"><!></span></span> <span class="hidden items-center gap-1 text-[11px] text-base-content/38 group-hover:flex sm:flex"><!> Enter</span></button>');function Qu(e,t){ee(t,!1);const n=R();let r=ae(t,"query",8,""),i=ae(t,"selected",8,!1);Be(()=>we(r()),()=>{g(n,Gi(r()))}),bn(),Bt();var s=Ju();let o;var l=x(s),c=x(l);Qc(c,{size:18});var u=A(l,2),d=x(u),p=x(d),f=A(d,2),h=x(f);{var m=$=>{var C=Tn();ue(()=>$e(C,`正文：${a(n),M(()=>a(n).body||"继续在搜索框中输入正文")??""}`)),N($,C)},b=$=>{var C=Tn("按 Space 继续输入正文");N($,C)};ie(h,$=>{a(n),M(()=>a(n).hasBodySeparator)?$(m):$(b,-1)})}var _=A(u,2),E=x(_);Lc(E,{size:13}),ue(()=>{ge(s,"aria-current",i()?"true":void 0),o=Wi(s,1,"quick-create group flex w-full items-center gap-3 rounded-box border border-dashed px-3 py-3 text-left transition svelte-1c7qagn",null,o,{selected:i()}),$e(p,`创建“${a(n),M(()=>a(n).title||"无标题")??""}”`)}),Y("click",s,function($){za.call(this,t,$)}),N(e,s),te()}var Zu=j('<span class="tooltip tooltip-bottom" data-tip="正在补充语义结果"><!></span>'),Xu=j('<span class="badge badge-ghost badge-sm hidden gap-1 border-base-300 text-[10px] text-base-content/55 sm:inline-flex">AI</span>'),ef=j('<button type="button" class="btn btn-ghost btn-circle btn-xs text-base-content/50" aria-label="清空搜索"><!></button>'),tf=j('<span class="h-full flex-1 bg-accent transition-[width] duration-150"></span>'),nf=j('<span><strong class="font-medium text-primary">标题</strong> · 按 Space 开始正文</span>'),rf=j('<span class="truncate"><strong class="font-medium text-primary">标题</strong> </span> <span class="ml-auto shrink-0">Space → 正文</span>',1),sf=j('<span class="max-w-[45%] truncate"><strong class="font-medium text-primary">标题</strong> </span> <span class="text-base-content/25">/</span> <span class="min-w-0 flex-1 truncate"><strong class="font-medium text-accent">正文</strong> </span>',1),af=j('<div class="surface sticky top-[calc(.75rem+var(--safe-top))] z-30 rounded-box shadow-sm"><div class="flex items-center gap-2 p-2 pb-1"><!> <input class="min-w-0 flex-1 bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-base-content/38" type="text" role="searchbox" inputmode="search" autocomplete="off" spellcheck="false" placeholder="输入标题，按空格继续写正文…" aria-label="搜索笔记或快速创建笔记" aria-describedby="quick-draft-hint"/> <!> <!> <button type="button" class="btn btn-ghost btn-circle btn-sm" aria-label="打开设置"><!></button></div> <div id="quick-draft-hint" class="px-3 pb-2" aria-live="polite"><div class="flex h-1.5 overflow-hidden rounded-full bg-base-300/70"><span class="h-full bg-primary transition-[width] duration-150"></span> <!></div> <div class="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-base-content/45"><!></div></div></div>');function of(e,t){ee(t,!1);const n=R(),r=R(),i=R();let s=ae(t,"value",8,""),o=ae(t,"semanticSearching",8,!1),l=ae(t,"semanticEnabled",8,!0),c=ae(t,"selectedIndex",8,0);const u=Gr();let d=R(),p=R(!1),f=0;function h(){var L,re;(L=a(d))==null||L.focus(),(re=a(d))==null||re.select()}function m(L){u("input",L.currentTarget.value)}function b(L){a(p)||Va(L)||L.key==="Enter"&&performance.now()<f||u("keyaction",L)}function _(){g(p,!1),f=performance.now()+100}Be(()=>we(s()),()=>{g(n,Gi(s()))}),Be(()=>a(n),()=>{g(r,Math.max(1,a(n).title.length+a(n).body.length))}),Be(()=>(a(n),a(r)),()=>{g(i,a(n).hasBodySeparator?Math.min(80,Math.max(20,a(n).title.length/a(r)*100)):100)}),bn();var E={focus:h};Bt();var $=af(),C=x($),G=x(C);tu(G,{size:18,class:"ml-1 shrink-0 text-base-content/45"});var S=A(G,2);jr(S,L=>g(d,L),()=>a(d));var k=A(S,2);{var T=L=>{var re=Zu(),Le=x(re);Yr(Le,{size:16,class:"animate-spin text-primary"}),N(L,re)},V=L=>{var re=Xu();N(L,re)},q=kn(()=>(we(l()),we(s()),M(()=>l()&&s().trim())));ie(k,L=>{o()?L(T):a(q)&&L(V,1)})}var Q=A(k,2);{var ve=L=>{var re=ef(),Le=x(re);Jr(Le,{size:15}),Y("click",re,()=>u("input","")),N(L,re)};ie(Q,L=>{s()&&L(ve)})}var ne=A(Q,2),fe=x(ne);ru(fe,{size:17});var Ce=A(C,2),he=x(Ce),oe=x(he),je=A(oe,2);{var de=L=>{var re=tf();N(L,re)};ie(je,L=>{a(n),M(()=>a(n).hasBodySeparator)&&L(de)})}var Se=A(he,2),Pe=x(Se);{var rt=L=>{var re=nf();N(L,re)},Z=L=>{var re=rf(),Le=J(re),xt=A(x(Le));ue(()=>$e(xt,` ${a(n),M(()=>a(n).title)??""}`)),N(L,re)},Oe=L=>{var re=sf(),Le=J(re),xt=A(x(Le)),Et=A(Le,4),I=A(x(Et));ue(()=>{$e(xt,` ${a(n),M(()=>a(n).title||"无标题")??""}`),$e(I,` ${a(n),M(()=>a(n).body||"继续输入…")??""}`)}),N(L,re)};ie(Pe,L=>{s()?(a(n),M(()=>!a(n).hasBodySeparator)?L(Z,1):L(Oe,-1)):L(rt)})}return ue(()=>{ge(S,"aria-activedescendant",`search-option-${c()}`),Ra(S,s()),Ca(oe,`width: ${s()?a(i):0}%`)}),Y("input",S,m),Y("compositionstart",S,()=>g(p,!0)),Y("compositionend",S,_),Y("keydown",S,b),Y("click",ne,()=>u("settings")),N(e,$),Ii(t,"focus",h),te(E)}var lf=j('<div class="fixed inset-0 z-40 bg-neutral/25 backdrop-blur-[2px]" role="presentation"></div> <aside class="surface fixed bottom-0 left-1/2 z-50 max-h-[88vh] w-full max-w-xl -translate-x-1/2 overflow-y-auto rounded-t-box p-5 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-box" aria-label="设置"><header class="mb-5 flex items-center justify-between"><div><h2 class="text-lg font-semibold">设置</h2> <p class="text-xs text-base-content/45">尽量保持简单，只控制检索和显示顺序。</p></div> <button class="btn btn-ghost btn-circle btn-sm" aria-label="关闭设置"><!></button></header> <div class="space-y-1"><label class="flex items-center gap-3 rounded-box px-3 py-3 hover:bg-base-200/60"><!> <span class="min-w-0 flex-1"><span class="block text-sm font-medium">笔记排序</span> <span class="block text-xs text-base-content/45">影响无搜索词时的平铺顺序</span></span> <select class="select select-bordered select-sm"><option>最近修改</option><option>最近创建</option><option>标题</option></select></label> <label class="flex cursor-pointer items-center gap-3 rounded-box px-3 py-3 hover:bg-base-200/60"><!> <span class="min-w-0 flex-1"><span class="block text-sm font-medium">语义搜索</span> <span class="block text-xs text-base-content/45">关键词结果不足时，使用余弦相似度补充</span></span> <input type="checkbox" class="toggle toggle-primary toggle-sm"/></label> <div class="flex items-center gap-3 rounded-box px-3 py-3"><!> <span class="min-w-0 flex-1"><span class="block text-sm font-medium">外观</span> <span class="block text-xs text-base-content/45">跟随设备，或固定为浅色 / 深色</span></span> <div class="join"><button class="btn btn-sm join-item">自动</button> <button class="btn btn-sm join-item">浅色</button> <button class="btn btn-sm join-item">深色</button></div></div></div> <div class="divider my-4"></div> <div class="rounded-box bg-base-200/55 p-3"><div class="flex items-center gap-2 text-xs font-medium"><!> </div> <p class="mt-1 break-all text-[11px] leading-5 text-base-content/45"> </p></div> <button class="btn btn-ghost mt-4 w-full gap-2 text-error"><!> </button></aside>',1);function cf(e,t){ee(t,!1);let n=ae(t,"open",8,!1),r=ae(t,"sortMode",8,"updated_desc"),i=ae(t,"semanticEnabled",8,!0),s=ae(t,"demoMode",8,!1),o=ae(t,"endpoint",8,"");const l=Gr();function c(f){l("sortchange",f.currentTarget.value)}Bt();var u=ce(),d=J(u);{var p=f=>{var h=lf(),m=J(h),b=A(m,2),_=x(b),E=A(x(_),2),$=x(E);Jr($,{size:17});var C=A(_,2),G=x(C),S=x(G);ja(S,{size:18,class:"text-base-content/45"});var k=A(S,4),T=x(k);T.value=T.__value="updated_desc";var V=A(T);V.value=V.__value="created_desc";var q=A(V);q.value=q.__value="title_asc";var Q;Pa(k);var ve=A(G,2),ne=x(ve);Ki(ne,{size:18,class:"text-primary/70"});var fe=A(ne,4),Ce=A(ve,2),he=x(Ce);Yc(he,{size:18,class:"text-base-content/45"});var oe=A(he,4),je=x(oe),de=A(je,2),Se=A(de,2),Pe=A(C,4),rt=x(Pe),Z=x(rt);Fa(Z,{size:14});var Oe=A(Z),L=A(rt,2),re=x(L),Le=A(Pe,2),xt=x(Le);Bc(xt,{size:16});var Et=A(xt);ue(()=>{Q!==(Q=r())&&(k.value=(k.__value=r())??"",Fr(k,r())),hc(fe,i()),$e(Oe,` ${s()?"演示模式":"Cloudflare 已连接"}`),$e(re,s()?"所有内容仅保存在当前页面内存，刷新后消失。":o()),$e(Et,` ${s()?"退出演示模式":"断开这个设备"}`)}),Y("click",m,()=>l("close")),Y("click",E,()=>l("close")),Y("change",k,c),Y("change",fe,I=>l("semanticchange",I.currentTarget.checked)),Y("click",je,()=>l("themechange","system")),Y("click",de,()=>l("themechange","notesflash")),Y("click",Se,()=>l("themechange","notesflash-dark")),Y("click",Le,()=>l("disconnect")),N(f,h)};ie(d,f=>{n()&&f(p)})}N(e,u),te()}async function uf(e){if(!e)return!1;try{return await navigator.clipboard.writeText(e),!0}catch{const t=document.createElement("textarea");t.value=e,t.setAttribute("readonly",""),t.style.position="fixed",t.style.opacity="0",document.body.appendChild(t),t.select();const n=document.execCommand("copy");return t.remove(),n}}var ff=j(" <!>",1),df=j('<div class="alert mb-3 min-h-0 rounded-box border border-warning/20 bg-warning/8 py-2 text-xs"><!> <span>演示模式：内容只在当前页面内存中，刷新后会消失。</span></div>'),vf=j('<div class="alert alert-error mb-3 min-h-0 rounded-box py-2 text-sm" role="alert"><span> </span> <button class="btn btn-ghost btn-xs">关闭</button></div>'),hf=j('<div class="mb-2"><!></div>'),pf=j('<div class="flex items-center justify-center gap-2 py-20 text-sm text-base-content/45"><!> 正在读取云端笔记…</div>'),mf=j('<div class="flex flex-col items-center py-20 text-center text-base-content/42"><!> <p class="mt-3 text-sm">还没有笔记</p> <button class="btn btn-primary btn-sm mt-4">创建第一条</button></div>'),_f=j("<!> 正在寻找语义相关内容…",1),gf=j('<div class="flex items-center justify-center gap-2 py-14 text-sm text-base-content/40"><!></div>'),yf=j("<div><!></div>"),bf=j('<section class="pb-16" aria-label="笔记流"></section>'),wf=j('<div class="toast toast-center toast-bottom z-[70] pb-[calc(1rem+var(--safe-bottom))]"><div class="alert min-h-0 border border-base-300 bg-neutral px-4 py-2 text-sm text-neutral-content shadow-lg"><span> </span></div></div>'),xf=j('<main class="app-shell"><!> <div class="mb-3 mt-3 flex min-h-5 items-center justify-between px-1 text-[11px] text-base-content/42"><span><!></span> <span class="hidden items-center gap-1.5 sm:flex"><!> ⇧ Space 唤起 · Tab 复制并编辑</span></div> <!> <!> <!> <!></main> <!> <!>',1);function Ef(e,t){ee(t,!1);const n=R(),r=R(),i=R(),s=R();let o=R(du()),l=R(a(o)?new As(a(o)):null),c=R(!1),u=R([]),d=R([]),p=R([]),f=R([]),h=R([]),m=R(""),b=R(0),_=R(null),E=R(!1),$=R(!1),C=R(!1),G=R(Xr("sort","updated_desc")),S=R(Xr("semantic","true")==="true"),k=Xr("theme","system"),T=R(""),V=R(""),q=R(),Q,ve,ne=0,fe=0,Ce=0,he=[],oe=0,je=0,de=R(null);const Se=()=>{Kt(),Qi()},Pe=()=>{document.visibilityState==="visible"&&Qi()},rt=window.matchMedia("(prefers-color-scheme: dark)"),Z=()=>{k==="system"&&Qr()};Ua(()=>{Qr(),!a(l)&&re()?Le():a(l)&&Oe(),window.addEventListener("keydown",xr),window.addEventListener("focus",Se),document.addEventListener("visibilitychange",Pe),rt.addEventListener("change",Z),Kt();const y=[];return"__TAURI_INTERNALS__"in window&&kc(()=>import("./event-C_pQPlB4.js"),[]).then(async({listen:w})=>{y.push(await w("notesflash://focus-search",()=>Kt(!0)),await w("notesflash://shortcut-error",()=>{Pt("全局快捷键被其他应用占用；NotesFlash 仍可从 Dock 打开。")}))}).catch(()=>{}),()=>{window.removeEventListener("keydown",xr),window.removeEventListener("focus",Se),document.removeEventListener("visibilitychange",Pe),rt.removeEventListener("change",Z),window.clearTimeout(Q),window.clearTimeout(ve),y.forEach(w=>w())}});async function Oe(){if(!a(l))return;const y=++oe;g(E,!0),g(T,"");try{const w=await a(l).listNotes(a(G),P=>{y===oe&&g(u,Ji(P))});y===oe&&(g(u,Ji(w)),Wa(a(u)),je=Date.now())}catch(w){y===oe&&Zr(w,"无法从云端载入笔记。")}finally{y===oe&&g(E,!1)}}function L(y){g(o,y),g(c,!1),g(l,new As(y)),g(u,[]),vu(y),Oe(),Kt(!0)}function re(){try{const y=new URLSearchParams(window.location.search);return y.get("demo")==="1"||y.get("demo")==="true"?!0:window.location.hash==="#demo"}catch{return!1}}function Le(){g(o,null),g(c,!0),g(l,new mu),Oe(),Kt(!0)}async function xt(){var y;if(a(de)&&!await a(de).flush()){Pt("仍有内容未保存，请先解决保存错误。");return}try{await((y=a(l))==null?void 0:y.logout())}catch{}hu(),oe+=1,g(o,null),g(l,null),g(c,!1),g(u,[]),g(m,""),g(_,null),g(C,!1)}function Et(y){g(m,y),g(b,0),g(T,""),window.clearTimeout(Q),window.clearTimeout(ve),g($,!1);const w=++ne,P=y.trim();g(d,[]),g(p,[]),fe=0,Ce=0,he=[],!(!P||!a(l))&&(Q=window.setTimeout(()=>void I(P,w),120),a(S)&&P.length>=3?ve=window.setTimeout(()=>void O(P,w),360):g(p,[]))}async function I(y,w){if(a(l))try{const P=await a(l).lexicalSearch(y);w===ne&&g(d,P)}catch(P){w===ne&&Zr(P,"关键词搜索失败。")}finally{w===ne&&(fe=w,Ce===w&&(g(p,he),Ce=0,he=[]))}}async function O(y,w){if(a(l)){g($,!0);try{const P=await a(l).semanticSearch(y);w===ne&&(fe===w?g(p,P):(Ce=w,he=P))}catch(P){w===ne&&(g(p,[]),Ce=0,he=[],P instanceof Vt&&[402,429,503].includes(P.status)&&Pt("语义搜索暂时不可用，已保留关键词结果。"))}finally{w===ne&&g($,!1)}}}async function H(){if(!a(l))return;if(a(de)&&!await a(de).flush()){Pt("当前笔记尚未保存，暂时不能创建另一条。");return}g(_,null);const y=Gi(a(m)),w=y.title||"新笔记";try{const P=await a(l).createNote({title:w,body:y.body});g(u,Er([P,...a(u).filter(kt=>kt.id!==P.id)])),Et(""),g(_,P.id),window.setTimeout(()=>{var kt;return(kt=document.getElementById(`note-${P.id}`))==null?void 0:kt.scrollIntoView({block:"nearest"})},0)}catch(P){Zr(P,"无法创建笔记。")}}async function pe(y,w){if(!a(l))throw new Error("尚未连接后端。");const P=await a(l).updateNote(y,w);return pt(P),P}async function ze(y){a(l)&&(await a(l).deleteNote(y.id,y.version),g(u,a(u).filter(w=>w.id!==y.id)),g(d,a(d).filter(w=>w.note.id!==y.id)),g(p,a(p).filter(w=>w.note.id!==y.id)),g(_,null),Pt("笔记已删除"),Kt())}async function De(y){if(!a(l))throw new Error("尚未连接后端。");if(y.size>12*1024*1024)throw new Error("单张图片不能超过 12 MB。");return a(l).uploadImage(y)}function pt(y){g(u,a(u).map(w=>w.id===y.id?y:w)),g(d,a(d).map(w=>w.note.id===y.id?{...w,note:y}:w)),g(p,a(p).map(w=>w.note.id===y.id?{...w,note:y}:w))}function Ve(y){const w=y.detail;if(Va(w))return;const P=!!a(m).trim();if(w.key==="ArrowDown"){w.preventDefault(),g(b,a(b)>=a(s)?0:a(b)+1),Zi(a(b));return}if(w.key==="ArrowUp"){w.preventDefault(),g(b,a(b)<=0?a(s):a(b)-1),Zi(a(b));return}if(w.key==="Enter"){w.preventDefault(),P&&a(b)===0?H():St(!1);return}if(w.key==="Tab"&&!(P&&a(b)===0)){w.preventDefault(),St(!0);return}w.key==="Escape"&&(w.preventDefault(),a(m)?Et(""):Ke())}async function St(y){const w=Ct();w&&await Wt(w.note.id)&&(y&&await Yn(w),window.setTimeout(()=>{var P,kt;(P=a(de))==null||P.focusBody(),(kt=document.getElementById(`note-${w.note.id}`))==null||kt.scrollIntoView({block:"nearest"})},0))}async function Wt(y){return a(_)===y?!0:a(de)&&!await a(de).flush()?(Pt("当前笔记尚未保存，仍保留在编辑状态。"),!1):(g(_,y),!0)}async function Ke(){if(a(de)&&!await a(de).flush()){Pt("保存失败，编辑内容仍保留。");return}g(_,null)}function Ct(){const y=a(b)-(a(m).trim()?1:0);return a(h)[y]}async function Yn(y){const w=qa(`${y.note.title}
${y.note.body}`,a(m))||y.note.title;await uf(w)&&Pt("已复制命中内容")}function xr(y){(y.metaKey||y.ctrlKey)&&y.key.toLocaleLowerCase()==="n"&&(y.preventDefault(),H()),(y.metaKey||y.ctrlKey)&&y.key===","&&(y.preventDefault(),g(C,!0)),(y.metaKey||y.ctrlKey)&&y.key.toLocaleLowerCase()==="k"&&(y.preventDefault(),Kt(!0))}function it(y){g(G,y),ei("sort",y),Oe()}function Er(y){return[...y].sort((w,P)=>a(G)==="title_asc"?w.title.localeCompare(P.title,"zh-CN"):a(G)==="created_desc"?P.createdAt-w.createdAt:P.updatedAt-w.updatedAt)}function Wa(y){const w=new Map(y.map(P=>[P.id,P]));g(d,a(d).map(P=>({...P,note:w.get(P.note.id)??P.note}))),g(p,a(p).map(P=>({...P,note:w.get(P.note.id)??P.note})))}function Ji(y){if(!a(_)||y.some(P=>P.id===a(_)))return y;const w=a(u).find(P=>P.id===a(_));return w?[w,...y]:y}function Qi(){!a(l)||a(E)||Date.now()-je<1200*60*1e3||Oe()}function Ka(y){g(S,y),ei("semantic",String(y)),y?a(m).trim()&&Et(a(m)):(g(p,[]),g($,!1),window.clearTimeout(ve))}function Ga(y){k=y,ei("theme",y),Qr()}function Qr(){document.documentElement.dataset.theme=k==="system"?rt.matches?"notesflash-dark":"notesflash":k}function Kt(y=!1){window.setTimeout(()=>{var w;(w=a(q))==null||w.focus()},20)}function Zi(y){window.setTimeout(()=>{var w;(w=document.getElementById(`search-option-${y}`))==null||w.scrollIntoView({block:"nearest",behavior:"smooth"})},0)}function Pt(y){g(V,y),window.setTimeout(()=>{a(V)===y&&g(V,"")},1800)}function Zr(y,w){g(T,y instanceof Error?y.message:w),y instanceof Vt&&y.status===401&&Pt("连接已失效，请重新配对。")}function Xr(y,w){try{return localStorage.getItem(`notesflash.preference.${y}`)??w}catch{return w}}function ei(y,w){try{localStorage.setItem(`notesflash.preference.${y}`,w)}catch{}}Be(()=>(a(m),a(d),a(p),a(u)),()=>{g(f,a(m).trim()?fu(a(d),a(p)):a(u).map(y=>({note:y,matchType:"lexical",snippet:"",score:0})))}),Be(()=>(a(_),a(f)),()=>{g(n,a(_)?a(f).find(y=>y.note.id===a(_)):void 0)}),Be(()=>(a(_),a(u)),()=>{g(r,a(_)?a(u).find(y=>y.id===a(_)):void 0)}),Be(()=>(a(n),a(r)),()=>{g(i,a(n)??(a(r)?{note:a(r),matchType:"lexical",snippet:"",score:Number.POSITIVE_INFINITY}:void 0))}),Be(()=>(a(i),a(f)),()=>{g(h,a(i)&&!a(f).some(y=>{var w;return y.note.id===((w=a(i))==null?void 0:w.note.id)})?[a(i),...a(f)]:a(f))}),Be(()=>(a(h),a(m)),()=>{g(s,Math.max(0,a(h).length-1+(a(m).trim()?1:0)))}),Be(()=>(a(b),a(s)),()=>{a(b)>a(s)&&g(b,a(s))}),bn(),Bt();var Xi=ce(),Ya=J(Xi);{var Ja=y=>{$u(y,{$$events:{connected:w=>L(w.detail),demo:Le}})},Qa=y=>{var w=xf(),P=J(w),kt=x(P);jr(of(kt,{get value(){return a(m)},get semanticSearching(){return a($)},get semanticEnabled(){return a(S)},get selectedIndex(){return a(b)},$$events:{input:U=>Et(U.detail),keyaction:Ve,settings:()=>g(C,!0)},$$legacy:!0}),U=>g(q,U),()=>a(q));var es=A(kt,2),ts=x(es),Za=x(ts);{var Xa=U=>{var W=ff(),me=J(W),ke=A(me);{var st=Ge=>{var Gt=Tn("· 正在补充语义结果");N(Ge,Gt)};ie(ke,Ge=>{a($)&&Ge(st)})}ue(()=>$e(me,`${a(h),M(()=>a(h).length)??""} 条匹配 `)),N(U,W)},eo=kn(()=>(a(m),M(()=>a(m).trim()))),to=U=>{var W=Tn();ue(()=>$e(W,`${a(u),M(()=>a(u).length)??""} 条笔记 · 全文平铺`)),N(U,W)};ie(Za,U=>{a(eo)?U(Xa):U(to,-1)})}var no=A(ts,2),ro=x(no);ja(ro,{size:12});var ns=A(es,2);{var io=U=>{var W=df(),me=x(W);Pc(me,{size:15}),N(U,W)};ie(ns,U=>{a(c)&&U(io)})}var rs=A(ns,2);{var so=U=>{var W=vf(),me=x(W),ke=x(me),st=A(me,2);ue(()=>$e(ke,a(T))),Y("click",st,()=>g(T,"")),N(U,W)};ie(rs,U=>{a(T)&&U(so)})}var is=A(rs,2);{var ao=U=>{var W=hf(),me=x(W);{let ke=Ut(()=>a(b)===0);Qu(me,{get query(){return a(m)},get selected(){return a(ke)},$$events:{click:H}})}N(U,W)},oo=kn(()=>(a(m),M(()=>a(m).trim())));ie(is,U=>{a(oo)&&U(ao)})}var lo=A(is,2);{var co=U=>{var W=pf(),me=x(W);Yr(me,{size:18,class:"animate-spin"}),N(U,W)},uo=U=>{var W=mf(),me=x(W);Xc(me,{size:30,strokeWidth:1.5});var ke=A(me,4);Y("click",ke,H),N(U,W)},fo=kn(()=>(a(h),a(m),M(()=>a(h).length===0&&!a(m).trim()))),vo=U=>{var W=gf(),me=x(W);{var ke=Ge=>{var Gt=_f(),ti=J(Gt);Ki(ti,{size:16,class:"text-primary"}),N(Ge,Gt)},st=Ge=>{var Gt=Tn("没有现有匹配，可以直接创建。");N(Ge,Gt)};ie(me,Ge=>{a($)?Ge(ke):Ge(st,-1)})}N(U,W)},ho=kn(()=>(a(h),a(m),M(()=>a(h).length===0&&a(m).trim()))),po=U=>{var W=bf();Gn(W,7,()=>a(h),me=>me.note.id,(me,ke,st)=>{var Ge=yf(),Gt=x(Ge);{var ti=wn=>{jr(Yu(wn,{get note(){return a(ke),M(()=>a(ke).note)},saveNote:pe,deleteNote:ze,uploadImage:De,close:()=>{g(_,null),Kt()},$$legacy:!0}),ni=>g(de,ni),()=>a(de))},go=wn=>{{let ni=Ut(()=>(we(a(st)),a(m),M(()=>a(st)+(a(m).trim()?1:0)))),yo=Ut(()=>(a(b),we(a(st)),a(m),M(()=>a(b)===a(st)+(a(m).trim()?1:0))));ju(wn,{get hit(){return a(ke)},get query(){return a(m)},get optionIndex(){return a(ni)},get selected(){return a(yo)},$$events:{edit:()=>void Wt(a(ke).note.id)}})}};ie(Gt,wn=>{a(_),a(ke),M(()=>a(_)===a(ke).note.id)?wn(ti):wn(go,-1)})}ue(()=>ge(Ge,"id",(a(ke),M(()=>`note-${a(ke).note.id}`)))),N(me,Ge)}),N(U,W)};ie(lo,U=>{a(E),a(h),M(()=>a(E)&&a(h).length===0)?U(co):a(fo)?U(uo,1):a(ho)?U(vo,2):U(po,-1)})}var ss=A(P,2);{let U=Ut(()=>(a(o),M(()=>{var W;return((W=a(o))==null?void 0:W.endpoint)??""})));cf(ss,{get open(){return a(C)},get sortMode(){return a(G)},get semanticEnabled(){return a(S)},get demoMode(){return a(c)},get endpoint(){return a(U)},$$events:{close:()=>g(C,!1),sortchange:W=>it(W.detail),semanticchange:W=>Ka(W.detail),themechange:W=>Ga(W.detail),disconnect:()=>void xt()}})}var mo=A(ss,2);{var _o=U=>{var W=wf(),me=x(W),ke=x(me),st=x(ke);ue(()=>$e(st,a(V))),N(U,W)};ie(mo,U=>{a(V)&&U(_o)})}N(y,w)};ie(Ya,y=>{a(l)?y(Qa,-1):y(Ja)})}N(e,Xi),te()}Zl(Ef,{target:document.getElementById("app")});
