var Mo=Object.defineProperty;var ya=e=>{throw TypeError(e)};var Co=(e,t,n)=>t in e?Mo(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var We=(e,t,n)=>Co(e,typeof t!="symbol"?t+"":t,n),yi=(e,t,n)=>t.has(e)||ya("Cannot "+n);var v=(e,t,n)=>(yi(e,t,"read from private field"),n?n.call(e):t.get(e)),q=(e,t,n)=>t.has(e)?ya("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,n),j=(e,t,n,r)=>(yi(e,t,"write to private field"),r?r.call(e,n):t.set(e,n),n),ne=(e,t,n)=>(yi(e,t,"access private method"),n);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))r(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&r(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function r(i){if(i.ep)return;i.ep=!0;const s=n(i);fetch(i.href,s)}})();const es=!1;var Mr=Array.isArray,Po=Array.prototype.indexOf,Zr=Array.prototype.includes,ci=Array.from,Do=Object.defineProperty,Jt=Object.getOwnPropertyDescriptor,ts=Object.getOwnPropertyDescriptors,Oo=Object.prototype,Ro=Array.prototype,Qi=Object.getPrototypeOf,ba=Object.isExtensible;function vr(e){return typeof e=="function"}const me=()=>{};function Lo(e){return e()}function Ii(e){for(var t=0;t<e.length;t++)e[t]()}function ns(){var e,t,n=new Promise((r,i)=>{e=r,t=i});return{promise:n,resolve:e,reject:t}}function zo(e,t){if(Array.isArray(e))return e;if(!(Symbol.iterator in e))return Array.from(e);const n=[];for(const r of e)if(n.push(r),n.length===t)break;return n}const Le=2,er=4,Cr=8,Ji=1<<24,Tt=16,bt=32,en=64,Mi=128,_t=512,Pe=1024,Oe=2048,yt=4096,Ge=8192,dt=16384,sr=32768,Ci=1<<25,mn=65536,Xr=1<<17,Uo=1<<18,or=1<<19,rs=1<<20,Ft=1<<25,Pn=65536,ei=1<<21,Wn=1<<22,pn=1<<23,jt=Symbol("$state"),is=Symbol("legacy props"),Fo=Symbol(""),Hr=Symbol("attributes"),Pi=Symbol("class"),Di=Symbol("style"),gr=Symbol("text"),Wr=Symbol("form reset"),Pr=new class extends Error{constructor(){super(...arguments);We(this,"name","StaleReactionError");We(this,"message","The reaction that called `getAbortSignal()` was re-run or destroyed")}};var Ja;const ui=!!((Ja=globalThis.document)!=null&&Ja.contentType)&&globalThis.document.contentType.includes("xml");function Zi(e){throw new Error("https://svelte.dev/e/lifecycle_outside_component")}function jo(){throw new Error("https://svelte.dev/e/async_derived_orphan")}function Vo(e,t,n){throw new Error("https://svelte.dev/e/each_key_duplicate")}function qo(e){throw new Error("https://svelte.dev/e/effect_in_teardown")}function Bo(){throw new Error("https://svelte.dev/e/effect_in_unowned_derived")}function Ho(e){throw new Error("https://svelte.dev/e/effect_orphan")}function Wo(){throw new Error("https://svelte.dev/e/effect_update_depth_exceeded")}function Ko(e){throw new Error("https://svelte.dev/e/props_invalid_value")}function Go(){throw new Error("https://svelte.dev/e/state_descriptors_fixed")}function Yo(){throw new Error("https://svelte.dev/e/state_prototype_fixed")}function Qo(){throw new Error("https://svelte.dev/e/state_unsafe_mutation")}function Jo(){throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror")}const Zo=1,Xo=2,as=4,el=8,tl=16,nl=1,rl=2,il=4,al=8,sl=16,ol=1,ll=2,Ce=Symbol("uninitialized"),ss="http://www.w3.org/1999/xhtml",cl="http://www.w3.org/2000/svg",ul="@attach";function fl(){console.warn("https://svelte.dev/e/derived_inert")}function dl(){console.warn("https://svelte.dev/e/select_multiple_invalid_value")}function vl(){console.warn("https://svelte.dev/e/svelte_boundary_reset_noop")}function os(e){return e===this.v}function hl(e,t){return e!=e?t==t:e!==t||e!==null&&typeof e=="object"||typeof e=="function"}function ls(e){return!hl(e,this.v)}let lr=!1,pl=!1;function ml(){lr=!0}let ve=null;function tr(e){ve=e}function ee(e,t=!1,n){ve={p:ve,i:!1,c:null,e:null,s:e,x:null,r:W,l:lr&&!t?{s:null,u:null,$:[]}:null}}function te(e){var t=ve,n=t.e;if(n!==null){t.e=null;for(var r of n)Is(r)}return e!==void 0&&(t.x=e),t.i=!0,ve=t.p,e??{}}function Dr(){return!lr||ve!==null&&ve.l===null}let wn=[];function cs(){var e=wn;wn=[],Ii(e)}function Zt(e){if(wn.length===0&&!Sr){var t=wn;queueMicrotask(()=>{t===wn&&cs()})}wn.push(e)}function gl(){for(;wn.length>0;)cs()}function us(e){var t=W;if(t===null)return G.f|=pn,e;if((t.f&sr)===0&&(t.f&er)===0)throw e;hn(e,t)}function hn(e,t){if(!(t!==null&&(t.f&dt)!==0)){for(;t!==null;){if((t.f&Mi)!==0){if((t.f&sr)===0)throw e;try{t.b.error(e);return}catch(n){e=n}}t=t.parent}throw e}}const _l=-7169;function xe(e,t){e.f=e.f&_l|t}function Xi(e){(e.f&_t)!==0||e.deps===null?xe(e,Pe):xe(e,yt)}function fs(e){if(e!==null)for(const t of e)(t.f&Le)===0||(t.f&Pn)===0||(t.f^=Pn,fs(t.deps))}function ds(e,t,n){(e.f&Oe)!==0?t.add(e):(e.f&yt)!==0&&n.add(e),fs(e.deps),xe(e,Pe)}let jr=!1;function yl(e){var t=jr;try{return jr=!1,[e(),jr]}finally{jr=t}}function bl(e,t){if(t){const n=document.body;e.autofocus=!0,Zt(()=>{document.activeElement===n&&e.focus()})}}let wa=!1;function wl(){wa||(wa=!0,document.addEventListener("reset",e=>{Promise.resolve().then(()=>{var t;if(!e.defaultPrevented)for(const n of e.target.elements)(t=n[Wr])==null||t.call(n)})},{capture:!0}))}function cr(e){var t=G,n=W;wt(null),xt(null);try{return e()}finally{wt(t),xt(n)}}function xl(e,t,n,r=n){e.addEventListener(t,()=>cr(n));const i=e[Wr];i?e[Wr]=()=>{i(),r(!0)}:e[Wr]=()=>r(!0),wl()}function Sl(e){let t=0,n=On(0),r;return()=>{ra()&&(a(n),Lr(()=>(t===0&&(r=M(()=>e(()=>Er(n)))),t+=1,()=>{Zt(()=>{t-=1,t===0&&(r==null||r(),r=void 0,Er(n))})})))}}var El=mn|or;function kl(e,t,n,r){new $l(e,t,n,r)}var pt,Yi,mt,kn,tt,gt,Ke,ct,Wt,$n,dn,Kn,$r,Nr,Kt,si,Ee,Nl,Al,Tl,Oi,Kr,Gr,Ri,Li;class $l{constructor(t,n,r,i){q(this,Ee);We(this,"parent");We(this,"is_pending",!1);We(this,"transform_error");q(this,pt);q(this,Yi,null);q(this,mt);q(this,kn);q(this,tt);q(this,gt,null);q(this,Ke,null);q(this,ct,null);q(this,Wt,null);q(this,$n,0);q(this,dn,0);q(this,Kn,!1);q(this,$r,new Set);q(this,Nr,new Set);q(this,Kt,null);q(this,si,Sl(()=>(j(this,Kt,On(v(this,$n))),()=>{j(this,Kt,null)})));var s;j(this,pt,t),j(this,mt,n),j(this,kn,o=>{var l=W;l.b=this,l.f|=Mi,r(o)}),this.parent=W.b,this.transform_error=i??((s=this.parent)==null?void 0:s.transform_error)??(o=>o),j(this,tt,zr(()=>{ne(this,Ee,Oi).call(this)},El))}defer_effect(t){ds(t,v(this,$r),v(this,Nr))}is_rendered(){return!this.is_pending&&(!this.parent||this.parent.is_rendered())}has_pending_snippet(){return!!v(this,mt).pending}update_pending_count(t,n){ne(this,Ee,Ri).call(this,t,n),j(this,$n,v(this,$n)+t),!(!v(this,Kt)||v(this,Kn))&&(j(this,Kn,!0),Zt(()=>{j(this,Kn,!1),v(this,Kt)&&rr(v(this,Kt),v(this,$n))}))}get_effect_pending(){return v(this,si).call(this),a(v(this,Kt))}error(t){if(!v(this,mt).onerror&&!v(this,mt).failed)throw t;L!=null&&L.is_fork?(v(this,gt)&&L.skip_effect(v(this,gt)),v(this,Ke)&&L.skip_effect(v(this,Ke)),v(this,ct)&&L.skip_effect(v(this,ct)),L.oncommit(()=>{ne(this,Ee,Li).call(this,t)})):ne(this,Ee,Li).call(this,t)}}pt=new WeakMap,Yi=new WeakMap,mt=new WeakMap,kn=new WeakMap,tt=new WeakMap,gt=new WeakMap,Ke=new WeakMap,ct=new WeakMap,Wt=new WeakMap,$n=new WeakMap,dn=new WeakMap,Kn=new WeakMap,$r=new WeakMap,Nr=new WeakMap,Kt=new WeakMap,si=new WeakMap,Ee=new WeakSet,Nl=function(){try{j(this,gt,it(()=>v(this,kn).call(this,v(this,pt))))}catch(t){this.error(t)}},Al=function(t){const n=v(this,mt).failed;n&&j(this,ct,it(()=>{n(v(this,pt),()=>t,()=>()=>{})}))},Tl=function(){const t=v(this,mt).pending;t&&(this.is_pending=!0,j(this,Ke,it(()=>t(v(this,pt)))),Zt(()=>{var n=j(this,Wt,document.createDocumentFragment()),r=Vt();n.append(r),j(this,gt,ne(this,Ee,Gr).call(this,()=>it(()=>v(this,kn).call(this,r)))),v(this,dn)===0&&(v(this,pt).before(n),j(this,Wt,null),Mn(v(this,Ke),()=>{j(this,Ke,null)}),ne(this,Ee,Kr).call(this,L))}))},Oi=function(){try{if(this.is_pending=this.has_pending_snippet(),j(this,dn,0),j(this,$n,0),j(this,gt,it(()=>{v(this,kn).call(this,v(this,pt))})),v(this,dn)>0){var t=j(this,Wt,document.createDocumentFragment());sa(v(this,gt),t);const n=v(this,mt).pending;j(this,Ke,it(()=>n(v(this,pt))))}else ne(this,Ee,Kr).call(this,L)}catch(n){this.error(n)}},Kr=function(t){this.is_pending=!1,t.transfer_effects(v(this,$r),v(this,Nr))},Gr=function(t){var n=W,r=G,i=ve;xt(v(this,tt)),wt(v(this,tt)),tr(v(this,tt).ctx);try{return Dn.ensure(),t()}catch(s){return us(s),null}finally{xt(n),wt(r),tr(i)}},Ri=function(t,n){var r;if(!this.has_pending_snippet()){this.parent&&ne(r=this.parent,Ee,Ri).call(r,t,n);return}j(this,dn,v(this,dn)+t),v(this,dn)===0&&(ne(this,Ee,Kr).call(this,n),v(this,Ke)&&Mn(v(this,Ke),()=>{j(this,Ke,null)}),v(this,Wt)&&(v(this,pt).before(v(this,Wt)),j(this,Wt,null)))},Li=function(t){v(this,gt)&&(Ue(v(this,gt)),j(this,gt,null)),v(this,Ke)&&(Ue(v(this,Ke)),j(this,Ke,null)),v(this,ct)&&(Ue(v(this,ct)),j(this,ct,null));var n=v(this,mt).onerror;let r=v(this,mt).failed;var i=!1,s=!1;const o=()=>{if(i){vl();return}i=!0,s&&Jo(),v(this,ct)!==null&&Mn(v(this,ct),()=>{j(this,ct,null)}),ne(this,Ee,Gr).call(this,()=>{ne(this,Ee,Oi).call(this)})},l=c=>{try{s=!0,n==null||n(c,o),s=!1}catch(u){hn(u,v(this,tt)&&v(this,tt).parent)}r&&j(this,ct,ne(this,Ee,Gr).call(this,()=>{try{return it(()=>{var u=W;u.b=this,u.f|=Mi,r(v(this,pt),()=>c,()=>o)})}catch(u){return hn(u,v(this,tt).parent),null}}))};Zt(()=>{var c;try{c=this.transform_error(t)}catch(u){hn(u,v(this,tt)&&v(this,tt).parent);return}c!==null&&typeof c=="object"&&typeof c.then=="function"?c.then(l,u=>hn(u,v(this,tt)&&v(this,tt).parent)):l(c)})};function vs(e,t,n,r){const i=Dr()?nr:Ut;var s=e.filter(p=>!p.settled),o=t.map(i);if(n.length===0&&s.length===0){r(o);return}var l=W,c=Il(),u=s.length===1?s[0].promise:s.length>1?Promise.all(s.map(p=>p.promise)):null;function d(p){if((l.f&dt)===0){c();try{r([...o,...p])}catch(g){hn(g,l)}ti()}}var h=hs();if(n.length===0){u.then(()=>d([])).finally(h);return}function f(){Promise.all(n.map(p=>Ml(p))).then(d).catch(p=>hn(p,l)).finally(h)}u?u.then(()=>{c(),f(),ti()}):f()}function Il(){var e=W,t=G,n=ve,r=L;return function(s=!0){xt(e),wt(t),tr(n),s&&(e.f&dt)===0&&(r==null||r.activate(),r==null||r.apply())}}function ti(e=!0){xt(null),wt(null),tr(null),e&&(L==null||L.deactivate())}function hs(){var e=W,t=e.b,n=L,r=!!(t!=null&&t.is_rendered());return t==null||t.update_pending_count(1,n),n.increment(r,e),()=>{t==null||t.update_pending_count(-1,n),n.decrement(r,e)}}function nr(e){var t=Le|Oe;return W!==null&&(W.f|=or),{ctx:ve,deps:null,effects:null,equals:os,f:t,fn:e,reactions:null,rv:0,v:Ce,wv:0,parent:W,ac:null}}const _r=Symbol("obsolete");function Ml(e,t,n){let r=W;r===null&&jo();var i=void 0,s=On(Ce),o=!G,l=new Set;return Hl(()=>{var p,g;var c=W,u=ns();i=u.promise;try{Promise.resolve(e()).then(u.resolve,b=>{b!==Pr&&u.reject(b)}).finally(ti)}catch(b){u.reject(b),ti()}var d=L;if(o){if((c.f&sr)!==0)var h=hs();if((p=r.b)!=null&&p.is_rendered())(g=d.async_deriveds.get(c))==null||g.reject(_r);else for(const b of l.values())b.reject(_r);l.add(u),d.async_deriveds.set(c,u)}const f=(b,_=void 0)=>{h==null||h(),l.delete(u),_!==_r&&(d.activate(),_?(s.f|=pn,rr(s,_)):((s.f&pn)!==0&&(s.f^=pn),rr(s,b)),d.deactivate())};u.promise.then(f,b=>f(null,b||"unknown"))}),Rr(()=>{for(const c of l)c.reject(_r)}),new Promise(c=>{function u(d){function h(){d===i?c(s):u(i)}d.then(h,h)}u(i)})}function qn(e){const t=nr(e);return Rs(t),t}function Ut(e){const t=nr(e);return t.equals=ls,t}function Cl(e){var t=e.effects;if(t!==null){e.effects=null;for(var n=0;n<t.length;n+=1)Ue(t[n])}}function ea(e){var t,n=W,r=e.parent;if(!tn&&r!==null&&e.v!==Ce&&(r.f&(dt|Ge))!==0)return fl(),e.v;xt(r);try{e.f&=~Pn,Cl(e),t=Fs(e)}finally{xt(n)}return t}function ps(e){var t=ea(e);if(!e.equals(t)&&(e.wv=zs(),(!(L!=null&&L.is_fork)||e.deps===null)&&(L!==null?(L.capture(e,t,!0),xr==null||xr.capture(e,t,!0)):e.v=t,e.deps===null))){xe(e,Pe);return}tn||(ze!==null?(ra()||L!=null&&L.is_fork)&&ze.set(e,t):Xi(e))}function Pl(e){var t;if(e.effects!==null)for(const n of e.effects)(n.teardown||n.ac)&&((t=n.teardown)==null||t.call(n),n.ac!==null&&cr(()=>{n.ac.abort(Pr),n.ac=null}),n.fn!==null&&(n.teardown=me),kr(n,0),aa(n))}function ms(e){if(e.effects!==null)for(const t of e.effects)t.teardown&&t.fn!==null&&Rn(t)}let bi=null,Fn=null,L=null,xr=null,ze=null,zi=null,Sr=!1,wi=!1,Bn=null,Yr=null;var xa=0;let Dl=1;var Gn,vn,Nn,Yn,Qn,Jn,Gt,Zn,nt,Ar,Yt,Nt,Lt,Xn,An,ce,Ui,yr,Fi,gs,_s,Vn,Ol,br;const oi=class oi{constructor(){q(this,ce);We(this,"id",Dl++);q(this,Gn,!1);We(this,"linked",!0);q(this,vn,null);q(this,Nn,null);We(this,"async_deriveds",new Map);We(this,"current",new Map);We(this,"previous",new Map);q(this,Yn,new Set);q(this,Qn,new Set);q(this,Jn,0);q(this,Gt,new Map);q(this,Zn,null);q(this,nt,[]);q(this,Ar,[]);q(this,Yt,new Set);q(this,Nt,new Set);q(this,Lt,new Map);q(this,Xn,new Set);We(this,"is_fork",!1);q(this,An,!1);Fn===null?bi=Fn=this:(j(Fn,Nn,this),j(this,vn,Fn)),Fn=this}skip_effect(t){v(this,Lt).has(t)||v(this,Lt).set(t,{d:[],m:[]}),v(this,Xn).delete(t)}unskip_effect(t,n=r=>this.schedule(r)){var r=v(this,Lt).get(t);if(r){v(this,Lt).delete(t);for(var i of r.d)xe(i,Oe),n(i);for(i of r.m)xe(i,yt),n(i)}v(this,Xn).add(t)}capture(t,n,r=!1){t.v!==Ce&&!this.previous.has(t)&&this.previous.set(t,t.v),(t.f&pn)===0&&(this.current.set(t,[n,r]),ze==null||ze.set(t,n)),this.is_fork||(t.v=n)}activate(){L=this}deactivate(){L=null,ze=null}flush(){try{wi=!0,L=this,ne(this,ce,yr).call(this)}finally{xa=0,zi=null,Bn=null,Yr=null,wi=!1,L=null,ze=null,In.clear()}}discard(){var t;for(const n of v(this,Qn))n(this);v(this,Qn).clear();for(const n of this.async_deriveds.values())n.reject(_r);ne(this,ce,br).call(this),(t=v(this,Zn))==null||t.resolve()}register_created_effect(t){v(this,Ar).push(t)}increment(t,n){if(j(this,Jn,v(this,Jn)+1),t){let r=v(this,Gt).get(n)??0;v(this,Gt).set(n,r+1)}}decrement(t,n){if(j(this,Jn,v(this,Jn)-1),t){let r=v(this,Gt).get(n)??0;r===1?v(this,Gt).delete(n):v(this,Gt).set(n,r-1)}v(this,An)||(j(this,An,!0),Zt(()=>{j(this,An,!1),this.linked&&this.flush()}))}transfer_effects(t,n){for(const r of t)v(this,Yt).add(r);for(const r of n)v(this,Nt).add(r);t.clear(),n.clear()}oncommit(t){v(this,Yn).add(t)}ondiscard(t){v(this,Qn).add(t)}settled(){return(v(this,Zn)??j(this,Zn,ns())).promise}static ensure(){if(L===null){const t=L=new oi;!wi&&!Sr&&Zt(()=>{v(t,Gn)||t.flush()})}return L}apply(){{ze=null;return}}schedule(t){var i;if(zi=t,(i=t.b)!=null&&i.is_pending&&(t.f&(er|Cr|Ji))!==0&&(t.f&sr)===0){t.b.defer_effect(t);return}for(var n=t;n.parent!==null;){n=n.parent;var r=n.f;if(Bn!==null&&n===W&&(G===null||(G.f&Le)===0))return;if((r&(en|bt))!==0){if((r&Pe)===0)return;n.f^=Pe}}v(this,nt).push(n)}};Gn=new WeakMap,vn=new WeakMap,Nn=new WeakMap,Yn=new WeakMap,Qn=new WeakMap,Jn=new WeakMap,Gt=new WeakMap,Zn=new WeakMap,nt=new WeakMap,Ar=new WeakMap,Yt=new WeakMap,Nt=new WeakMap,Lt=new WeakMap,Xn=new WeakMap,An=new WeakMap,ce=new WeakSet,Ui=function(){if(this.is_fork)return!0;for(const r of v(this,Gt).keys()){for(var t=r,n=!1;t.parent!==null;){if(v(this,Lt).has(t)){n=!0;break}t=t.parent}if(!n)return!0}return!1},yr=function(){var c,u,d,h;j(this,Gn,!0),xa++>1e3&&(ne(this,ce,br).call(this),Ll());for(const f of v(this,Yt))v(this,Nt).delete(f),xe(f,Oe),this.schedule(f);for(const f of v(this,Nt))xe(f,yt),this.schedule(f);const t=v(this,nt);j(this,nt,[]),this.apply();var n=Bn=[],r=[],i=Yr=[];for(const f of t)try{ne(this,ce,Fi).call(this,f,n,r)}catch(p){throw ws(f),ne(this,ce,Ui).call(this)||this.discard(),p}if(L=null,i.length>0){var s=oi.ensure();for(const f of i)s.schedule(f)}if(Bn=null,Yr=null,ne(this,ce,Ui).call(this)){ne(this,ce,Vn).call(this,r),ne(this,ce,Vn).call(this,n);for(const[f,p]of v(this,Lt))bs(f,p);i.length>0&&ne(c=L,ce,yr).call(c);return}const o=ne(this,ce,gs).call(this);if(o){ne(this,ce,Vn).call(this,r),ne(this,ce,Vn).call(this,n),ne(u=o,ce,_s).call(u,this);return}v(this,Yt).clear(),v(this,Nt).clear();for(const f of v(this,Yn))f(this);v(this,Yn).clear(),xr=this,Sa(r),Sa(n),xr=null,(d=v(this,Zn))==null||d.resolve();var l=L;if(v(this,Jn)===0&&(v(this,nt).length===0||l!==null)&&ne(this,ce,br).call(this),v(this,nt).length>0)if(l!==null){const f=l;v(f,nt).push(...v(this,nt).filter(p=>!v(f,nt).includes(p)))}else l=this;l!==null&&ne(h=l,ce,yr).call(h)},Fi=function(t,n,r){t.f^=Pe;for(var i=t.first;i!==null;){var s=i.f,o=(s&(bt|en))!==0,l=o&&(s&Pe)!==0,c=l||(s&Ge)!==0||v(this,Lt).has(i);if(!c&&i.fn!==null){o?i.f^=Pe:(s&er)!==0?n.push(i):ur(i)&&((s&Tt)!==0&&v(this,Nt).add(i),Rn(i));var u=i.first;if(u!==null){i=u;continue}}for(;i!==null;){var d=i.next;if(d!==null){i=d;break}i=i.parent}}},gs=function(){for(var t=v(this,vn);t!==null;){if(!t.is_fork){for(const[n,[,r]]of this.current)if(t.current.has(n)&&!r)return t}t=v(t,vn)}return null},_s=function(t){var r;for(const[i,s]of t.current)!this.previous.has(i)&&t.previous.has(i)&&this.previous.set(i,t.previous.get(i)),this.current.set(i,s);for(const[i,s]of t.async_deriveds){const o=this.async_deriveds.get(i);o&&s.promise.then(o.resolve).catch(o.reject)}t.async_deriveds.clear(),this.transfer_effects(v(t,Yt),v(t,Nt));const n=i=>{var s=i.reactions;if(s!==null&&!((i.f&Le)!==0&&(i.f&(Oe|yt))===0))for(const c of s){var o=c.f;if((o&Le)!==0)n(c);else{var l=c;o&(Wn|Tt)&&!this.async_deriveds.has(l)&&(v(this,Nt).delete(l),xe(l,Oe),this.schedule(l))}}};for(const i of this.current.keys())n(i);this.oncommit(()=>t.discard()),ne(r=t,ce,br).call(r),L=this,ne(this,ce,yr).call(this)},Vn=function(t){for(var n=0;n<t.length;n+=1)ds(t[n],v(this,Yt),v(this,Nt))},Ol=function(){var h;for(let f=bi;f!==null;f=v(f,Nn)){var t=f.id<this.id,n=[];for(const[p,[g,b]]of this.current){if(f.current.has(p)){var r=f.current.get(p)[0];if(t&&g!==r)f.current.set(p,[g,b]);else continue}n.push(p)}if(t)for(const[p,g]of this.async_deriveds){const b=f.async_deriveds.get(p);b&&g.promise.then(b.resolve).catch(b.reject)}var i=[...f.current.keys()].filter(p=>!f.current.get(p)[1]);if(!(!v(f,Gn)||i.length===0)){var s=i.filter(p=>!this.current.has(p));if(s.length===0)t&&f.discard();else if(n.length>0){if(t)for(const p of v(this,Xn))f.unskip_effect(p,g=>{var b;(g.f&(Tt|Wn))!==0?f.schedule(g):ne(b=f,ce,Vn).call(b,[g])});f.activate();var o=new Set,l=new Map;for(var c of n)ys(c,s,o,l);l=new Map;var u=[...f.current].filter(([p,g])=>{const b=this.current.get(p);return b?b[0]!==g[0]||b[1]!==g[1]:!0}).map(([p])=>p);if(u.length>0)for(const p of v(this,Ar))(p.f&(dt|Ge|Xr))===0&&ta(p,u,l)&&((p.f&(Wn|Tt))!==0?(xe(p,Oe),f.schedule(p)):v(f,Yt).add(p));if(v(f,nt).length>0&&!v(f,An)){f.apply();for(var d of v(f,nt))ne(h=f,ce,Fi).call(h,d,[],[]);j(f,nt,[])}f.deactivate()}}}},br=function(){if(this.linked){var t=v(this,vn),n=v(this,Nn);t===null?bi=n:j(t,Nn,n),n===null?Fn=t:j(n,vn,t),this.linked=!1}};let Dn=oi;function Rl(e){var t=Sr;Sr=!0;try{for(var n;;){if(gl(),L===null)return n;L.flush()}}finally{Sr=t}}function Ll(){try{Wo()}catch(e){hn(e,zi)}}let $t=null;function Sa(e){var t=e.length;if(t!==0){for(var n=0;n<t;){var r=e[n++];if((r.f&(dt|Ge))===0&&ur(r)&&($t=new Set,Rn(r),r.deps===null&&r.first===null&&r.nodes===null&&r.teardown===null&&r.ac===null&&Ps(r),($t==null?void 0:$t.size)>0)){In.clear();for(const i of $t){if((i.f&(dt|Ge))!==0)continue;const s=[i];let o=i.parent;for(;o!==null;)$t.has(o)&&($t.delete(o),s.push(o)),o=o.parent;for(let l=s.length-1;l>=0;l--){const c=s[l];(c.f&(dt|Ge))===0&&Rn(c)}}$t.clear()}}$t=null}}function ys(e,t,n,r){if(!n.has(e)&&(n.add(e),e.reactions!==null))for(const i of e.reactions){const s=i.f;(s&Le)!==0?ys(i,t,n,r):(s&(Wn|Tt))!==0&&(s&Oe)===0&&ta(i,t,r)&&(xe(i,Oe),na(i))}}function ta(e,t,n){const r=n.get(e);if(r!==void 0)return r;if(e.deps!==null)for(const i of e.deps){if(Zr.call(t,i))return!0;if((i.f&Le)!==0&&ta(i,t,n))return n.set(i,!0),!0}return n.set(e,!1),!1}function na(e){L.schedule(e)}function bs(e,t){if(!((e.f&bt)!==0&&(e.f&Pe)!==0)){(e.f&Oe)!==0?t.d.push(e):(e.f&yt)!==0&&t.m.push(e),xe(e,Pe);for(var n=e.first;n!==null;)bs(n,t),n=n.next}}function ws(e){xe(e,Pe);for(var t=e.first;t!==null;)ws(t),t=t.next}let ni=new Set;const In=new Map;let xs=!1;function On(e,t){var n={f:0,v:e,reactions:null,equals:os,rv:0,wv:0};return n}function un(e,t){const n=On(e);return Rs(n),n}function O(e,t=!1,n=!0){var i;const r=On(e);return t||(r.equals=ls),lr&&n&&ve!==null&&ve.l!==null&&((i=ve.l).s??(i.s=[])).push(r),r}function m(e,t,n=!1){G!==null&&(!It||(G.f&Xr)!==0)&&Dr()&&(G.f&(Le|Tt|Wn|Xr))!==0&&(qt===null||!qt.has(e))&&Qo();let r=n?Hn(t):t;return rr(e,r,Yr)}function rr(e,t,n=null){if(!e.equals(t)){In.set(e,tn?t:e.v);var r=Dn.ensure();if(r.capture(e,t),(e.f&Le)!==0){const i=e;(e.f&Oe)!==0&&ea(i),ze===null&&Xi(i)}e.wv=zs(),Ss(e,Oe,n),Dr()&&W!==null&&(W.f&Pe)!==0&&(W.f&(bt|en))===0&&(ht===null?Gl([e]):ht.push(e)),!r.is_fork&&ni.size>0&&!xs&&zl()}return t}function zl(){xs=!1;for(const e of ni){(e.f&Pe)!==0&&xe(e,yt);let t;try{t=ur(e)}catch{t=!0}t&&Rn(e)}ni.clear()}function Er(e){m(e,e.v+1)}function Ss(e,t,n){var r=e.reactions;if(r!==null)for(var i=Dr(),s=r.length,o=0;o<s;o++){var l=r[o],c=l.f;if(!(!i&&l===W)){var u=(c&Oe)===0;if(u&&xe(l,t),(c&Xr)!==0)ni.add(l);else if((c&Le)!==0){var d=l;ze==null||ze.delete(d),(c&Pn)===0&&(c&_t&&(W===null||(W.f&ei)===0)&&(l.f|=Pn),Ss(d,yt,n))}else if(u){var h=l;(c&Tt)!==0&&$t!==null&&$t.add(h),n!==null?n.push(h):na(h)}}}}function Hn(e){if(typeof e!="object"||e===null||jt in e)return e;const t=Qi(e);if(t!==Oo&&t!==Ro)return e;var n=new Map,r=Mr(e),i=un(0),s=Cn,o=l=>{if(Cn===s)return l();var c=G,u=Cn;wt(null),Na(s);var d=l();return wt(c),Na(u),d};return r&&n.set("length",un(e.length)),new Proxy(e,{defineProperty(l,c,u){(!("value"in u)||u.configurable===!1||u.enumerable===!1||u.writable===!1)&&Go();var d=n.get(c);return d===void 0?o(()=>{var h=un(u.value);return n.set(c,h),h}):m(d,u.value,!0),!0},deleteProperty(l,c){var u=n.get(c);if(u===void 0){if(c in l){const d=o(()=>un(Ce));n.set(c,d),Er(i)}}else m(u,Ce),Er(i);return!0},get(l,c,u){var p;if(c===jt)return e;var d=n.get(c),h=c in l;if(d===void 0&&(!h||(p=Jt(l,c))!=null&&p.writable)&&(d=o(()=>{var g=Hn(h?l[c]:Ce),b=un(g);return b}),n.set(c,d)),d!==void 0){var f=a(d);return f===Ce?void 0:f}return Reflect.get(l,c,u)},getOwnPropertyDescriptor(l,c){var u=Reflect.getOwnPropertyDescriptor(l,c);if(u&&"value"in u){var d=n.get(c);d&&(u.value=a(d))}else if(u===void 0){var h=n.get(c),f=h==null?void 0:h.v;if(h!==void 0&&f!==Ce)return{enumerable:!0,configurable:!0,value:f,writable:!0}}return u},has(l,c){var f;if(c===jt)return!0;var u=n.get(c),d=u!==void 0&&u.v!==Ce||Reflect.has(l,c);if(u!==void 0||W!==null&&(!d||(f=Jt(l,c))!=null&&f.writable)){u===void 0&&(u=o(()=>{var p=d?Hn(l[c]):Ce,g=un(p);return g}),n.set(c,u));var h=a(u);if(h===Ce)return!1}return d},set(l,c,u,d){var P;var h=n.get(c),f=c in l;if(r&&c==="length")for(var p=u;p<h.v;p+=1){var g=n.get(p+"");g!==void 0?m(g,Ce):p in l&&(g=o(()=>un(Ce)),n.set(p+"",g))}if(h===void 0)(!f||(P=Jt(l,c))!=null&&P.writable)&&(h=o(()=>un(void 0)),m(h,Hn(u)),n.set(c,h));else{f=h.v!==Ce;var b=o(()=>Hn(u));m(h,b)}var _=Reflect.getOwnPropertyDescriptor(l,c);if(_!=null&&_.set&&_.set.call(d,u),!f){if(r&&typeof c=="string"){var E=n.get("length"),A=Number(c);Number.isInteger(A)&&A>=E.v&&m(E,A+1)}Er(i)}return!0},ownKeys(l){a(i);var c=Reflect.ownKeys(l).filter(h=>{var f=n.get(h);return f===void 0||f.v!==Ce});for(var[u,d]of n)d.v!==Ce&&!(u in l)&&c.push(u);return c},setPrototypeOf(){Yo()}})}function Ea(e){try{if(e!==null&&typeof e=="object"&&jt in e)return e[jt]}catch{}return e}function Ul(e,t){return Object.is(Ea(e),Ea(t))}var ka,Es,ks,$s;function Fl(){if(ka===void 0){ka=window,Es=/Firefox/.test(navigator.userAgent);var e=Element.prototype,t=Node.prototype,n=Text.prototype;ks=Jt(t,"firstChild").get,$s=Jt(t,"nextSibling").get,ba(e)&&(e[Pi]=void 0,e[Hr]=null,e[Di]=void 0,e.__e=void 0),ba(n)&&(n[gr]=void 0)}}function Vt(e=""){return document.createTextNode(e)}function ir(e){return ks.call(e)}function Or(e){return $s.call(e)}function x(e,t){return ir(e)}function H(e,t=!1){{var n=ir(e);return n instanceof Comment&&n.data===""?Or(n):n}}function $(e,t=1,n=!1){let r=e;for(;t--;)r=Or(r);return r}function jl(e){e.textContent=""}function Ns(){return!1}function As(e,t,n){return t==null||t===ss?n?document.createElement(e,{is:n}):document.createElement(e):n?document.createElementNS(t,e,{is:n}):document.createElementNS(t,e)}function Ts(e){W===null&&(G===null&&Ho(),Bo()),tn&&qo()}function Vl(e,t){var n=t.last;n===null?t.last=t.first=e:(n.next=e,e.prev=n,t.last=e)}function Mt(e,t){var n=W;n!==null&&(n.f&Ge)!==0&&(e|=Ge);var r={ctx:ve,deps:null,nodes:null,f:e|Oe|_t,first:null,fn:t,last:null,next:null,parent:n,b:n&&n.b,prev:null,teardown:null,wv:0,ac:null};L==null||L.register_created_effect(r);var i=r;if((e&er)!==0)Bn!==null?Bn.push(r):Dn.ensure().schedule(r);else if(t!==null){try{Rn(r)}catch(o){throw Ue(r),o}i.deps===null&&i.teardown===null&&i.nodes===null&&i.first===i.last&&(i.f&or)===0&&(i=i.first,(e&Tt)!==0&&(e&mn)!==0&&i!==null&&(i.f|=mn))}if(i!==null&&(i.parent=n,n!==null&&Vl(i,n),G!==null&&(G.f&Le)!==0&&(e&en)===0)){var s=G;(s.effects??(s.effects=[])).push(i)}return r}function ra(){return G!==null&&!It}function Rr(e){const t=Mt(Cr,null);return xe(t,Pe),t.teardown=e,t}function ji(e){Ts();var t=W.f,n=!G&&(t&bt)!==0&&ve!==null&&!ve.i;if(n){var r=ve;(r.e??(r.e=[])).push(e)}else return Is(e)}function Is(e){return Mt(er|rs,e)}function ql(e){return Ts(),Mt(Cr|rs,e)}function Bl(e){Dn.ensure();const t=Mt(en|or,e);return(n={})=>new Promise(r=>{n.outro?Mn(t,()=>{Ue(t),r(void 0)}):(Ue(t),r(void 0))})}function ia(e){return Mt(er,e)}function ft(e,t){var n=ve,r={effect:null,ran:!1,deps:e};n.l.$.push(r),r.effect=Lr(()=>{if(e(),!r.ran){r.ran=!0;var i=W;try{xt(i.parent),M(t)}finally{xt(i)}}})}function gn(){var e=ve;Lr(()=>{for(var t of e.l.$){t.deps();var n=t.effect;(n.f&Pe)!==0&&n.deps!==null&&xe(n,yt),ur(n)&&Rn(n),t.ran=!1}})}function Hl(e){return Mt(Wn|or,e)}function Lr(e,t=0){return Mt(Cr|t,e)}function le(e,t=[],n=[],r=[]){vs(r,t,n,i=>{Mt(Cr,()=>{e(...i.map(a))})})}function zr(e,t=0){var n=Mt(Tt|t,e);return n}function Ms(e,t=0){var n=Mt(Ji|t,e);return n}function it(e){return Mt(bt|or,e)}function Cs(e){var t=e.teardown;if(t!==null){const n=tn,r=G;$a(!0),wt(null);try{t.call(null)}finally{$a(n),wt(r)}}}function aa(e,t=!1){var n=e.first;for(e.first=e.last=null;n!==null;){const i=n.ac;i!==null&&cr(()=>{i.abort(Pr)});var r=n.next;(n.f&en)!==0?n.parent=null:Ue(n,t),n=r}}function Wl(e){for(var t=e.first;t!==null;){var n=t.next;(t.f&bt)===0&&Ue(t),t=n}}function Ue(e,t=!0){var n=!1;(t||(e.f&Uo)!==0)&&e.nodes!==null&&e.nodes.end!==null&&(Kl(e.nodes.start,e.nodes.end),n=!0),e.f|=Ci,aa(e,t&&!n),kr(e,0);var r=e.nodes&&e.nodes.t;if(r!==null)for(const s of r)s.stop();Cs(e),e.f^=Ci,e.f|=dt;var i=e.parent;i!==null&&i.first!==null&&Ps(e),e.next=e.prev=e.teardown=e.ctx=e.deps=e.fn=e.nodes=e.ac=e.b=null}function Kl(e,t){for(;e!==null;){var n=e===t?null:Or(e);e.remove(),e=n}}function Ps(e){var t=e.parent,n=e.prev,r=e.next;n!==null&&(n.next=r),r!==null&&(r.prev=n),t!==null&&(t.first===e&&(t.first=r),t.last===e&&(t.last=n))}function Mn(e,t,n=!0){var r=[];Ds(e,r,!0);var i=()=>{n&&Ue(e),t&&t()},s=r.length;if(s>0){var o=()=>--s||i();for(var l of r)l.out(o)}else i()}function Ds(e,t,n){if((e.f&Ge)===0){e.f^=Ge;var r=e.nodes&&e.nodes.t;if(r!==null)for(const l of r)(l.is_global||n)&&t.push(l);for(var i=e.first;i!==null;){var s=i.next;if((i.f&en)===0){var o=(i.f&mn)!==0||(i.f&bt)!==0&&(e.f&Tt)!==0;Ds(i,t,o?n:!1)}i=s}}}function ri(e){Os(e,!0)}function Os(e,t){if((e.f&Ge)!==0){e.f^=Ge,(e.f&Pe)===0&&(xe(e,Oe),Dn.ensure().schedule(e));for(var n=e.first;n!==null;){var r=n.next,i=(n.f&mn)!==0||(n.f&bt)!==0;Os(n,i?t:!1),n=r}var s=e.nodes&&e.nodes.t;if(s!==null)for(const o of s)(o.is_global||t)&&o.in()}}function sa(e,t){if(e.nodes)for(var n=e.nodes.start,r=e.nodes.end;n!==null;){var i=n===r?null:Or(n);t.append(n),n=i}}let Qr=!1,tn=!1;function $a(e){tn=e}let G=null,It=!1;function wt(e){G=e}let W=null;function xt(e){W=e}let qt=null;function Rs(e){G!==null&&(qt??(qt=new Set)).add(e)}let rt=null,lt=0,ht=null;function Gl(e){ht=e}let Ls=1,xn=0,Cn=xn;function Na(e){Cn=e}function zs(){return++Ls}function ur(e){var t=e.f;if((t&Oe)!==0)return!0;if(t&Le&&(e.f&=~Pn),(t&yt)!==0){for(var n=e.deps,r=n.length,i=0;i<r;i++){var s=n[i];if(ur(s)&&ps(s),s.wv>e.wv)return!0}(t&_t)!==0&&ze===null&&xe(e,Pe)}return!1}function Us(e,t,n=!0){var r=e.reactions;if(r!==null&&!(qt!==null&&qt.has(e)))for(var i=0;i<r.length;i++){var s=r[i];(s.f&Le)!==0?Us(s,t,!1):t===s&&(n?xe(s,Oe):(s.f&Pe)!==0&&xe(s,yt),na(s))}}function Fs(e){var b;var t=rt,n=lt,r=ht,i=G,s=qt,o=ve,l=It,c=Cn,u=e.f;rt=null,lt=0,ht=null,G=(u&(bt|en))===0?e:null,qt=null,tr(e.ctx),It=!1,Cn=++xn,e.ac!==null&&(cr(()=>{e.ac.abort(Pr)}),e.ac=null);try{e.f|=ei;var d=e.fn,h=d();e.f|=sr;var f=e.deps,p=L==null?void 0:L.is_fork;if(rt!==null){var g;if(p||kr(e,lt),f!==null&&lt>0)for(f.length=lt+rt.length,g=0;g<rt.length;g++)f[lt+g]=rt[g];else e.deps=f=rt;if(ra()&&(e.f&_t)!==0)for(g=lt;g<f.length;g++)((b=f[g]).reactions??(b.reactions=[])).push(e)}else!p&&f!==null&&lt<f.length&&(kr(e,lt),f.length=lt);if(Dr()&&ht!==null&&!It&&f!==null&&(e.f&(Le|yt|Oe))===0)for(g=0;g<ht.length;g++)Us(ht[g],e);if(i!==null&&i!==e){if(xn++,i.deps!==null)for(let _=0;_<n;_+=1)i.deps[_].rv=xn;if(t!==null)for(const _ of t)_.rv=xn;ht!==null&&(r===null?r=ht:r.push(...ht))}return(e.f&pn)!==0&&(e.f^=pn),h}catch(_){return us(_)}finally{e.f^=ei,rt=t,lt=n,ht=r,G=i,qt=s,tr(o),It=l,Cn=c}}function Yl(e,t){let n=t.reactions;if(n!==null){var r=Po.call(n,e);if(r!==-1){var i=n.length-1;i===0?n=t.reactions=null:(n[r]=n[i],n.pop())}}if(n===null&&(t.f&Le)!==0&&(rt===null||!Zr.call(rt,t))){var s=t;(s.f&_t)!==0&&(s.f^=_t,s.f&=~Pn),s.v!==Ce&&Xi(s),s.ac!==null&&cr(()=>{s.ac.abort(Pr),s.ac=null}),Pl(s),kr(s,0)}}function kr(e,t){var n=e.deps;if(n!==null)for(var r=t;r<n.length;r++)Yl(e,n[r])}function Rn(e){var t=e.f;if((t&dt)===0){xe(e,Pe);var n=W,r=Qr;W=e,Qr=(t&(bt|en))===0;try{(t&(Tt|Ji))!==0?Wl(e):aa(e),Cs(e);var i=Fs(e);e.teardown=typeof i=="function"?i:null,e.wv=Ls;var s;es&&pl&&(e.f&Oe)!==0&&e.deps}finally{Qr=r,W=n}}}async function Ql(){await Promise.resolve(),Rl()}function a(e){var t=e.f,n=(t&Le)!==0;if(G!==null&&!It){var r=W!==null&&(W.f&dt)!==0;if(!r&&(qt===null||!qt.has(e))){var i=G.deps;if((G.f&ei)!==0)e.rv<xn&&(e.rv=xn,rt===null&&i!==null&&i[lt]===e?lt++:rt===null?rt=[e]:rt.push(e));else{G.deps??(G.deps=[]),Zr.call(G.deps,e)||G.deps.push(e);var s=e.reactions;s===null?e.reactions=[G]:Zr.call(s,G)||s.push(G)}}}if(tn&&In.has(e))return In.get(e);if(n){var o=e;if(tn){var l=o.v;return((o.f&Pe)===0&&o.reactions!==null||Vs(o))&&(l=ea(o)),In.set(o,l),l}var c=(o.f&_t)===0&&!It&&G!==null&&(Qr||(G.f&_t)!==0),u=(o.f&sr)===0;ur(o)&&(c&&(o.f|=_t),ps(o)),c&&!u&&(ms(o),js(o))}if(ze!=null&&ze.has(e))return ze.get(e);if((e.f&pn)!==0)throw e.v;return e.v}function js(e){if(e.f|=_t,e.deps!==null)for(const t of e.deps)(t.reactions??(t.reactions=[])).push(e),(t.f&Le)!==0&&(t.f&_t)===0&&(ms(t),js(t))}function Vs(e){if(e.v===Ce)return!0;if(e.deps===null)return!1;for(const t of e.deps)if(In.has(t)||(t.f&Le)!==0&&Vs(t))return!0;return!1}function M(e){var t=It;try{return It=!0,e()}finally{It=t}}function _e(e){if(!(typeof e!="object"||!e||e instanceof EventTarget)){if(jt in e)Vi(e);else if(!Array.isArray(e))for(let t in e){const n=e[t];typeof n=="object"&&n&&jt in n&&Vi(n)}}}function Vi(e,t=new Set){if(typeof e=="object"&&e!==null&&!(e instanceof EventTarget)&&!t.has(e)){t.add(e),e instanceof Date&&e.getTime();for(let r in e)try{Vi(e[r],t)}catch{}const n=Qi(e);if(n!==Object.prototype&&n!==Array.prototype&&n!==Map.prototype&&n!==Set.prototype&&n!==Date.prototype){const r=ts(n);for(let i in r){const s=r[i].get;if(s)try{s.call(e)}catch{}}}}}function Jl(e){return e.endsWith("capture")&&e!=="gotpointercapture"&&e!=="lostpointercapture"}const Zl=["beforeinput","click","change","dblclick","contextmenu","focusin","focusout","input","keydown","keyup","mousedown","mousemove","mouseout","mouseover","mouseup","pointerdown","pointermove","pointerout","pointerover","pointerup","touchend","touchmove","touchstart"];function Xl(e){return Zl.includes(e)}const ec={formnovalidate:"formNoValidate",ismap:"isMap",nomodule:"noModule",playsinline:"playsInline",readonly:"readOnly",defaultvalue:"defaultValue",defaultchecked:"defaultChecked",srcobject:"srcObject",novalidate:"noValidate",allowfullscreen:"allowFullscreen",disablepictureinpicture:"disablePictureInPicture",disableremoteplayback:"disableRemotePlayback"};function tc(e){return e=e.toLowerCase(),ec[e]??e}const nc=["touchstart","touchmove"];function rc(e){return nc.includes(e)}const Sn=Symbol("events"),qs=new Set,qi=new Set;function Bs(e,t,n,r={}){function i(s){if(r.capture||Bi.call(t,s),!s.cancelBubble)return cr(()=>n==null?void 0:n.call(this,s))}return e.startsWith("pointer")||e.startsWith("touch")||e==="wheel"?Zt(()=>{t.addEventListener(e,i,r)}):t.addEventListener(e,i,r),i}function Y(e,t,n,r,i){var s={capture:r,passive:i},o=Bs(e,t,n,s);(t===document.body||t===window||t===document||t instanceof HTMLMediaElement)&&Rr(()=>{t.removeEventListener(e,o,s)})}function ic(e,t,n){(t[Sn]??(t[Sn]={}))[e]=n}function ac(e){for(var t=0;t<e.length;t++)qs.add(e[t]);for(var n of qi)n(e)}let Aa=null;function Bi(e){var b,_;var t=this,n=t.ownerDocument,r=e.type,i=((b=e.composedPath)==null?void 0:b.call(e))||[],s=i[0]||e.target;Aa=e;var o=0,l=Aa===e&&e[Sn];if(l){var c=i.indexOf(l);if(c!==-1&&(t===document||t===window)){e[Sn]=t;return}var u=i.indexOf(t);if(u===-1)return;c<=u&&(o=c)}if(s=i[o]||e.target,s!==t){Do(e,"currentTarget",{configurable:!0,get(){return s||n}});var d=G,h=W;wt(null),xt(null);try{for(var f,p=[];s!==null&&s!==t;){try{var g=(_=s[Sn])==null?void 0:_[r];g!=null&&(!s.disabled||e.target===s)&&g.call(s,e)}catch(E){f?p.push(E):f=E}if(e.cancelBubble)break;o++,s=o<i.length?i[o]:null}if(f){for(let E of p)queueMicrotask(()=>{throw E});throw f}}finally{e[Sn]=t,delete e.currentTarget,wt(d),xt(h)}}}var Za;const xi=((Za=globalThis==null?void 0:globalThis.window)==null?void 0:Za.trustedTypes)&&globalThis.window.trustedTypes.createPolicy("svelte-trusted-html",{createHTML:e=>e});function sc(e){return(xi==null?void 0:xi.createHTML(e))??e}function Hs(e){var t=As("template");return t.innerHTML=sc(e.replaceAll("<!>","<!---->")),t.content}function ar(e,t){var n=W;n.nodes===null&&(n.nodes={start:e,end:t,a:null,t:null})}function z(e,t){var n=(t&ol)!==0,r=(t&ll)!==0,i,s=!e.startsWith("<!>");return()=>{i===void 0&&(i=Hs(s?e:"<!>"+e),n||(i=ir(i)));var o=r||Es?document.importNode(i,!0):i.cloneNode(!0);if(n){var l=ir(o),c=o.lastChild;ar(l,c)}else ar(o,o);return o}}function oc(e,t,n="svg"){var r=!e.startsWith("<!>"),i=`<${n}>${r?e:"<!>"+e}</${n}>`,s;return()=>{if(!s){var o=Hs(i),l=ir(o);s=ir(l)}var c=s.cloneNode(!0);return ar(c,c),c}}function lc(e,t){return oc(e,t,"svg")}function En(e=""){{var t=Vt(e+"");return ar(t,t),t}}function ue(){var e=document.createDocumentFragment(),t=document.createComment(""),n=Vt();return e.append(t,n),ar(t,n),e}function S(e,t){e!==null&&e.before(t)}function pe(e,t){var n=t==null?"":typeof t=="object"?`${t}`:t;n!==(e[gr]??(e[gr]=e.nodeValue))&&(e[gr]=n,e.nodeValue=`${n}`)}function cc(e,t){return uc(e,t)}const Vr=new Map;function uc(e,{target:t,anchor:n,props:r={},events:i,context:s,intro:o=!0,transformError:l}){Fl();var c=void 0,u=Bl(()=>{var d=n??t.appendChild(Vt());kl(d,{pending:()=>{}},p=>{ee({});var g=ve;s&&(g.c=s),i&&(r.$$events=i),c=e(p,r)||{},te()},l);var h=new Set,f=p=>{for(var g=0;g<p.length;g++){var b=p[g];if(!h.has(b)){h.add(b);var _=rc(b);for(const P of[t,document]){var E=Vr.get(P);E===void 0&&(E=new Map,Vr.set(P,E));var A=E.get(b);A===void 0?(P.addEventListener(b,Bi,{passive:_}),E.set(b,1)):E.set(b,A+1)}}}};return f(ci(qs)),qi.add(f),()=>{var _;for(var p of h)for(const E of[t,document]){var g=Vr.get(E),b=g.get(p);--b==0?(E.removeEventListener(p,Bi),g.delete(p),g.size===0&&Vr.delete(E)):g.set(p,b)}qi.delete(f),d!==n&&((_=d.parentNode)==null||_.removeChild(d))}});return fc.set(c,u),c}let fc=new WeakMap;var At,zt,ut,Tn,Tr,Ir,li;class oa{constructor(t,n=!0){We(this,"anchor");q(this,At,new Map);q(this,zt,new Map);q(this,ut,new Map);q(this,Tn,new Set);q(this,Tr,!0);q(this,Ir,t=>{if(v(this,At).has(t)){var n=v(this,At).get(t),r=v(this,zt).get(n);if(r)ri(r),v(this,Tn).delete(n);else{var i=v(this,ut).get(n);i&&(ri(i.effect),v(this,zt).set(n,i.effect),v(this,ut).delete(n),i.fragment.lastChild.remove(),this.anchor.before(i.fragment),r=i.effect)}for(const[s,o]of v(this,At)){if(v(this,At).delete(s),s===t)break;const l=v(this,ut).get(o);l&&(Ue(l.effect),v(this,ut).delete(o))}for(const[s,o]of v(this,zt)){if(s===n||v(this,Tn).has(s))continue;const l=()=>{if(Array.from(v(this,At).values()).includes(s)){var u=document.createDocumentFragment();sa(o,u),u.append(Vt()),v(this,ut).set(s,{effect:o,fragment:u})}else Ue(o);v(this,Tn).delete(s),v(this,zt).delete(s)};v(this,Tr)||!r?(v(this,Tn).add(s),Mn(o,l,!1)):l()}}});q(this,li,t=>{v(this,At).delete(t);const n=Array.from(v(this,At).values());for(const[r,i]of v(this,ut))n.includes(r)||(Ue(i.effect),v(this,ut).delete(r))});this.anchor=t,j(this,Tr,n)}ensure(t,n){var r=L,i=Ns();if(n&&!v(this,zt).has(t)&&!v(this,ut).has(t))if(i){var s=document.createDocumentFragment(),o=Vt();s.append(o),v(this,ut).set(t,{effect:it(()=>n(o)),fragment:s})}else v(this,zt).set(t,it(()=>n(this.anchor)));if(v(this,At).set(r,t),i){for(const[l,c]of v(this,zt))l===t?r.unskip_effect(c):r.skip_effect(c);for(const[l,c]of v(this,ut))l===t?r.unskip_effect(c.effect):r.skip_effect(c.effect);r.oncommit(v(this,Ir)),r.ondiscard(v(this,li))}else v(this,Ir).call(this,r)}}At=new WeakMap,zt=new WeakMap,ut=new WeakMap,Tn=new WeakMap,Tr=new WeakMap,Ir=new WeakMap,li=new WeakMap;function Q(e,t,n=!1){var r=new oa(e),i=n?mn:0;function s(o,l){r.ensure(o,l)}zr(()=>{var o=!1;t((l,c=0)=>{o=!0,s(c,l)}),o||s(-1,null)},i)}function la(e,t){return t}function dc(e,t,n){for(var r=[],i=t.length,s,o=t.length,l=0;l<i;l++){let h=t[l];Mn(h,()=>{if(s){if(s.pending.delete(h),s.done.add(h),s.pending.size===0){var f=e.outrogroups;Hi(e,ci(s.done)),f.delete(s),f.size===0&&(e.outrogroups=null)}}else o-=1},!1)}if(o===0){var c=r.length===0&&n!==null;if(c){var u=n,d=u.parentNode;jl(d),d.append(u),e.items.clear()}Hi(e,t,!c)}else s={pending:new Set(t),done:new Set},(e.outrogroups??(e.outrogroups=new Set)).add(s)}function Hi(e,t,n=!0){var r;if(e.pending.size>0){r=new Set;for(const o of e.pending.values())for(const l of o)r.add(e.items.get(l).e)}for(var i=0;i<t.length;i++){var s=t[i];if(r!=null&&r.has(s)){s.f|=Ft;const o=document.createDocumentFragment();sa(s,o)}else Ue(t[i],n)}}var Ta;function fr(e,t,n,r,i,s=null){var o=e,l=new Map,c=(t&as)!==0;if(c){var u=e;o=u.appendChild(Vt())}var d=null,h=Ut(()=>{var P=n();return Mr(P)?P:P==null?[]:ci(P)}),f,p=new Map,g=!0;function b(P){(A.effect.f&dt)===0&&(A.pending.delete(P),A.fallback=d,vc(A,f,o,t,r),d!==null&&(f.length===0?(d.f&Ft)===0?ri(d):(d.f^=Ft,wr(d,null,o)):Mn(d,()=>{d=null})))}function _(P){A.pending.delete(P)}var E=zr(()=>{f=a(h);for(var P=f.length,K=new Set,k=L,T=Ns(),N=0;N<P;N+=1){var F=f[N],V=r(F,N),J=g?null:l.get(V);J?(J.v&&rr(J.v,F),J.i&&rr(J.i,N),T&&k.unskip_effect(J.e)):(J=hc(l,g?o:Ta??(Ta=Vt()),F,V,N,i,t,n),g||(J.e.f|=Ft),l.set(V,J)),K.add(V)}if(P===0&&s&&!d&&(g?d=it(()=>s(o)):(d=it(()=>s(Ta??(Ta=Vt()))),d.f|=Ft)),P>K.size&&Vo(),!g)if(p.set(k,K),T){for(const[ge,ie]of l)K.has(ge)||k.skip_effect(ie.e);k.oncommit(b),k.ondiscard(_)}else b(k);a(h)}),A={effect:E,items:l,pending:p,outrogroups:null,fallback:d};g=!1}function hr(e){for(;e!==null&&(e.f&bt)===0;)e=e.next;return e}function vc(e,t,n,r,i){var J,ge,ie,we,Te,Ne,fe,Ae,he;var s=(r&el)!==0,o=t.length,l=e.items,c=hr(e.effect.first),u,d=null,h,f=[],p=[],g,b,_,E;if(s)for(E=0;E<o;E+=1)g=t[E],b=i(g,E),_=l.get(b).e,(_.f&Ft)===0&&((ge=(J=_.nodes)==null?void 0:J.a)==null||ge.measure(),(h??(h=new Set)).add(_));for(E=0;E<o;E+=1){if(g=t[E],b=i(g,E),_=l.get(b).e,e.outrogroups!==null)for(const de of e.outrogroups)de.pending.delete(_),de.done.delete(_);if((_.f&Ge)!==0&&(ri(_),s&&((we=(ie=_.nodes)==null?void 0:ie.a)==null||we.unfix(),(h??(h=new Set)).delete(_))),(_.f&Ft)!==0)if(_.f^=Ft,_===c)wr(_,null,n);else{var A=d?d.next:c;_===e.effect.last&&(e.effect.last=_.prev),_.prev&&(_.prev.next=_.next),_.next&&(_.next.prev=_.prev),fn(e,d,_),fn(e,_,A),wr(_,A,n),d=_,f=[],p=[],c=hr(d.next);continue}if(_!==c){if(u!==void 0&&u.has(_)){if(f.length<p.length){var P=p[0],K;d=P.prev;var k=f[0],T=f[f.length-1];for(K=0;K<f.length;K+=1)wr(f[K],P,n);for(K=0;K<p.length;K+=1)u.delete(p[K]);fn(e,k.prev,T.next),fn(e,d,k),fn(e,T,P),c=P,d=T,E-=1,f=[],p=[]}else u.delete(_),wr(_,c,n),fn(e,_.prev,_.next),fn(e,_,d===null?e.effect.first:d.next),fn(e,d,_),d=_;continue}for(f=[],p=[];c!==null&&c!==_;)(u??(u=new Set)).add(c),p.push(c),c=hr(c.next);if(c===null)continue}(_.f&Ft)===0&&f.push(_),d=_,c=hr(_.next)}if(e.outrogroups!==null){for(const de of e.outrogroups)de.pending.size===0&&(Hi(e,ci(de.done)),(Te=e.outrogroups)==null||Te.delete(de));e.outrogroups.size===0&&(e.outrogroups=null)}if(c!==null||u!==void 0){var N=[];if(u!==void 0)for(_ of u)(_.f&Ge)===0&&N.push(_);for(;c!==null;)(c.f&Ge)===0&&c!==e.fallback&&N.push(c),c=hr(c.next);var F=N.length;if(F>0){var V=(r&as)!==0&&o===0?n:null;if(s){for(E=0;E<F;E+=1)(fe=(Ne=N[E].nodes)==null?void 0:Ne.a)==null||fe.measure();for(E=0;E<F;E+=1)(he=(Ae=N[E].nodes)==null?void 0:Ae.a)==null||he.fix()}dc(e,N,V)}}s&&Zt(()=>{var de,qe;if(h!==void 0)for(_ of h)(qe=(de=_.nodes)==null?void 0:de.a)==null||qe.apply()})}function hc(e,t,n,r,i,s,o,l){var c=(o&Zo)!==0?(o&tl)===0?O(n,!1,!1):On(n):null,u=(o&Xo)!==0?On(i):null;return{v:c,i:u,e:it(()=>(s(t,c??n,u??i,l),()=>{e.delete(r)}))}}function wr(e,t,n){if(e.nodes)for(var r=e.nodes.start,i=e.nodes.end,s=t&&(t.f&Ft)===0?t.nodes.start:n;r!==null;){var o=Or(r);if(s.before(r),r===i)return;r=o}}function fn(e,t,n){t===null?e.effect.first=n:t.next=n,n===null?e.effect.last=t:n.prev=t}function ye(e,t,...n){var r=new oa(e);zr(()=>{const i=t()??null;r.ensure(i,i&&(s=>i(s,...n)))},mn)}function pc(e,t,n,r,i,s){var o=null,l=e,c=new oa(l,!1);zr(()=>{const u=t()||null;var d=cl;if(u===null){c.ensure(null,null);return}return c.ensure(u,h=>{if(u){if(o=As(u,d),ar(o,o),r){var f=null,p=o.appendChild(Vt());r(o,p),f==null||f.remove()}W.nodes.end=o,h.before(o)}}),()=>{}},mn),Rr(()=>{})}function mc(e,t){var n=void 0,r;Ms(()=>{n!==(n=t())&&(r&&(Ue(r),r=null),n&&(r=it(()=>{ia(()=>n(e))})))})}function Ws(e){var t,n,r="";if(typeof e=="string"||typeof e=="number")r+=e;else if(typeof e=="object")if(Array.isArray(e)){var i=e.length;for(t=0;t<i;t++)e[t]&&(n=Ws(e[t]))&&(r&&(r+=" "),r+=n)}else for(n in e)e[n]&&(r&&(r+=" "),r+=n);return r}function gc(){for(var e,t,n=0,r="",i=arguments.length;n<i;n++)(e=arguments[n])&&(t=Ws(e))&&(r&&(r+=" "),r+=t);return r}function _c(e){return typeof e=="object"?gc(e):e??""}const Ia=[...` 	
\r\f \v\uFEFF`];function yc(e,t,n){var r=e==null?"":""+e;if(t&&(r=r?r+" "+t:t),n){for(var i of Object.keys(n))if(n[i])r=r?r+" "+i:i;else if(r.length)for(var s=i.length,o=0;(o=r.indexOf(i,o))>=0;){var l=o+s;(o===0||Ia.includes(r[o-1]))&&(l===r.length||Ia.includes(r[l]))?r=(o===0?"":r.substring(0,o))+r.substring(l+1):o=l}}return r===""?null:r}function Ma(e,t=!1){var n=t?" !important;":";",r="";for(var i of Object.keys(e)){var s=e[i];s!=null&&s!==""&&(r+=" "+i+": "+s+n)}return r}function Si(e){return e[0]!=="-"||e[1]!=="-"?e.toLowerCase():e}function bc(e,t){if(t){var n="",r,i;if(Array.isArray(t)?(r=t[0],i=t[1]):r=t,e){e=String(e).replaceAll(/\s*\/\*.*?\*\/\s*/g,"").trim();var s=!1,o=0,l=!1,c=[];r&&c.push(...Object.keys(r).map(Si)),i&&c.push(...Object.keys(i).map(Si));var u=0,d=-1;const b=e.length;for(var h=0;h<b;h++){var f=e[h];if(l?f==="/"&&e[h-1]==="*"&&(l=!1):s?s===f&&(s=!1):f==="/"&&e[h+1]==="*"?l=!0:f==='"'||f==="'"?s=f:f==="("?o++:f===")"&&o--,!l&&s===!1&&o===0){if(f===":"&&d===-1)d=h;else if(f===";"||h===b-1){if(d!==-1){var p=Si(e.substring(u,d).trim());if(!c.includes(p)){f!==";"&&h++;var g=e.substring(u,h).trim();n+=" "+g+";"}}u=h+1,d=-1}}}}return r&&(n+=Ma(r)),i&&(n+=Ma(i,!0)),n=n.trim(),n===""?null:n}return e==null?null:String(e)}function ca(e,t,n,r,i,s){var o=e[Pi];if(o!==n||o===void 0){var l=yc(n,r,s);l==null?e.removeAttribute("class"):t?e.className=l:e.setAttribute("class",l),e[Pi]=n}else if(s&&i!==s)for(var c in s){var u=!!s[c];(i==null||u!==!!i[c])&&e.classList.toggle(c,u)}return s}function Ei(e,t={},n,r){for(var i in n){var s=n[i];t[i]!==s&&(n[i]==null?e.style.removeProperty(i):e.style.setProperty(i,s,r))}}function Ks(e,t,n,r){var i=e[Di];if(i!==t){var s=bc(t,r);s==null?e.removeAttribute("style"):e.style.cssText=s,e[Di]=t}else r&&(Array.isArray(r)?(Ei(e,n==null?void 0:n[0],r[0]),Ei(e,n==null?void 0:n[1],r[1],"important")):Ei(e,n,r));return r}function ii(e,t,n=!1){if(e.multiple){if(t==null)return;if(!Mr(t))return dl();for(var r of e.options)r.selected=t.includes(Ca(r));return}for(r of e.options){var i=Ca(r);if(Ul(i,t)){r.selected=!0;return}}(!n||t!==void 0)&&(e.selectedIndex=-1)}function Gs(e){var t=new MutationObserver(()=>{ii(e,e.__value)});t.observe(e,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["value"]}),Rr(()=>{t.disconnect()})}function Ca(e){return"__value"in e?e.__value:e.value}const pr=Symbol("class"),mr=Symbol("style"),Ys=Symbol("is custom element"),Qs=Symbol("is html"),wc=ui?"input":"INPUT",xc=ui?"option":"OPTION",Sc=ui?"select":"SELECT",Ec=ui?"progress":"PROGRESS";function Js(e,t){var n=fi(e);n.value===(n.value=t??void 0)||e.value===t&&(t!==0||e.nodeName!==Ec)||(e.value=t??"")}function kc(e,t){var n=fi(e);n.checked!==(n.checked=t??void 0)&&(e.checked=t)}function $c(e,t){t?e.hasAttribute("selected")||e.setAttribute("selected",""):e.removeAttribute("selected")}function Se(e,t,n,r){var i=fi(e);i[t]!==(i[t]=n)&&(t==="loading"&&(e[Fo]=n),n==null?e.removeAttribute(t):typeof n!="string"&&Zs(e).includes(t)?e[t]=n:e.setAttribute(t,n))}function Nc(e,t,n,r,i=!1,s=!1){var o=fi(e),l=o[Ys],c=!o[Qs],u=t||{},d=e.nodeName===xc;for(var h in t)h in n||(n[h]=null);n.class?n.class=_c(n.class):n[pr]&&(n.class=null),n[mr]&&(n.style??(n.style=null));var f=Zs(e);if(e.nodeName===wc&&"type"in n&&("value"in n||"__value"in n)){var p=n.type;(p!==u.type||p===void 0&&e.hasAttribute("type"))&&(u.type=p,Se(e,"type",p))}for(const k in n){let T=n[k];if(d&&k==="value"&&T==null){e.value=e.__value="",u[k]=T;continue}if(k==="class"){var g=e.namespaceURI==="http://www.w3.org/1999/xhtml";ca(e,g,T,r,t==null?void 0:t[pr],n[pr]),u[k]=T,u[pr]=n[pr];continue}if(k==="style"){Ks(e,T,t==null?void 0:t[mr],n[mr]),u[k]=T,u[mr]=n[mr];continue}var b=u[k];if(!(T===b&&!(T===void 0&&e.hasAttribute(k)))){u[k]=T;var _=k[0]+k[1];if(_!=="$$")if(_==="on"){const N={},F="$$"+k;let V=k.slice(2);var E=Xl(V);if(Jl(V)&&(V=V.slice(0,-7),N.capture=!0),!E&&b){if(T!=null)continue;e.removeEventListener(V,u[F],N),u[F]=null}if(E)ic(V,e,T),ac([V]);else if(T!=null){let J=function(ge){u[k].call(this,ge)};var K=J;u[F]=Bs(V,e,J,N)}}else if(k==="style")Se(e,k,T);else if(k==="autofocus")bl(e,!!T);else if(!l&&(k==="__value"||k==="value"&&T!=null))e.value=e.__value=T;else if(k==="selected"&&d)$c(e,T);else{var A=k;c||(A=tc(A));var P=A==="defaultValue"||A==="defaultChecked";if(T==null&&!l&&!P)if(o[k]=null,A==="value"||A==="checked"){let N=e;const F=t===void 0;if(A==="value"){let V=N.defaultValue;N.removeAttribute(A),N.defaultValue=V,N.value=N.__value=F?V:null}else{let V=N.defaultChecked;N.removeAttribute(A),N.defaultChecked=V,N.checked=F?V:!1}}else e.removeAttribute(k);else P||f.includes(A)&&(l||typeof T!="string")?(e[A]=T,A in o&&(o[A]=Ce)):typeof T!="function"&&Se(e,A,T)}}}return u}function Pa(e,t,n=[],r=[],i=[],s,o=!1,l=!1){vs(i,n,r,c=>{var u=void 0,d={},h=e.nodeName===Sc,f=!1;if(Ms(()=>{var g=t(...c.map(a)),b=Nc(e,u,g,s,o,l);f&&h&&"value"in g&&ii(e,g.value);for(let E of Object.getOwnPropertySymbols(d))g[E]||Ue(d[E]);for(let E of Object.getOwnPropertySymbols(g)){var _=g[E];E.description===ul&&(!u||_!==u[E])&&(d[E]&&Ue(d[E]),d[E]=it(()=>mc(e,()=>_))),b[E]=_}u=b}),h){var p=e;ia(()=>{ii(p,u.value,!0),Gs(p)})}f=!0})}function fi(e){return e[Hr]??(e[Hr]={[Ys]:e.nodeName.includes("-"),[Qs]:e.namespaceURI===ss})}var Da=new Map;function Zs(e){var t=e.getAttribute("is")||e.nodeName,n=Da.get(t);if(n)return n;Da.set(t,n=[]);for(var r,i=e,s=Element.prototype;s!==i;){r=ts(i);for(var o in r)r[o].set&&o!=="innerHTML"&&o!=="textContent"&&o!=="innerText"&&n.push(o);i=Qi(i)}return n}function Jr(e,t,n=t){var r=new WeakSet;xl(e,"input",async i=>{var s=i?e.defaultValue:e.value;if(s=ki(e)?$i(s):s,n(s),L!==null&&r.add(L),await Ql(),s!==(s=t())){var o=e.selectionStart,l=e.selectionEnd,c=e.value.length;if(e.value=s??"",l!==null){var u=e.value.length;o===l&&l===c&&u>c?(e.selectionStart=u,e.selectionEnd=u):(e.selectionStart=o,e.selectionEnd=Math.min(l,u))}}}),M(t)==null&&e.value&&(n(ki(e)?$i(e.value):e.value),L!==null&&r.add(L)),Lr(()=>{var i=t();if(e===document.activeElement){var s=L;if(r.has(s))return}ki(e)&&i===$i(e.value)||e.type==="date"&&!i&&!e.value||i!==e.value&&(e.value=i??"")})}function ki(e){var t=e.type;return t==="number"||t==="range"}function $i(e){return e===""?null:+e}function Wi(e,t,n){var r=Jt(e,t);r&&r.set&&(e[t]=n,Rr(()=>{e[t]=null}))}function Ni(e,t){return e===t||(e==null?void 0:e[jt])===t}function ai(e={},t,n,r){var i=ve.r,s=W;return ia(()=>{var o,l;return Lr(()=>{o=l,l=[],M(()=>{Ni(n(...l),e)||(t(e,...l),o&&Ni(n(...o),e)&&t(null,...o))})}),()=>{let c=s;for(;c!==i&&c.parent!==null&&c.parent.f&Ci;)c=c.parent;const u=()=>{l&&Ni(n(...l),e)&&t(null,...l)},d=c.teardown;c.teardown=()=>{u(),d==null||d()}}}),e}function Ac(e){return function(...t){var n=t[0];return n.stopPropagation(),e==null?void 0:e.apply(this,t)}}function Tc(e){return function(...t){var n=t[0];return n.preventDefault(),e==null?void 0:e.apply(this,t)}}function nn(e=!1){const t=ve,n=t.l.u;if(!n)return;let r=()=>_e(t.s);if(e){let i=0,s={};const o=nr(()=>{let l=!1;const c=t.s;for(const u in c)c[u]!==s[u]&&(s[u]=c[u],l=!0);return l&&i++,i});r=()=>a(o)}n.b.length&&ql(()=>{Oa(t,r),Ii(n.b)}),ji(()=>{const i=M(()=>n.m.map(Lo));return()=>{for(const s of i)typeof s=="function"&&s()}}),n.a.length&&ji(()=>{Oa(t,r),Ii(n.a)})}function Oa(e,t){if(e.l.s)for(const n of e.l.s)a(n);t()}function Xs(e,t){var s;var n=(s=e.$$events)==null?void 0:s[t.type],r=Mr(n)?n.slice():n==null?[]:[n];for(var i of r)i.call(this,t)}const Ic={get(e,t){if(!e.exclude.has(t))return e.props[t]},set(e,t){return!1},getOwnPropertyDescriptor(e,t){if(!e.exclude.has(t)&&t in e.props)return{enumerable:!0,configurable:!0,value:e.props[t]}},has(e,t){return e.exclude.has(t)?!1:t in e.props},ownKeys(e){return Reflect.ownKeys(e.props).filter(t=>!e.exclude.has(t))}};function be(e,t,n){return new Proxy({props:e,exclude:t},Ic)}const Mc={get(e,t){let n=e.props.length;for(;n--;){let r=e.props[n];if(vr(r)&&(r=r()),typeof r=="object"&&r!==null&&t in r)return r[t]}},set(e,t,n){let r=e.props.length;for(;r--;){let i=e.props[r];vr(i)&&(i=i());const s=Jt(i,t);if(s&&s.set)return s.set(n),!0}return!1},getOwnPropertyDescriptor(e,t){let n=e.props.length;for(;n--;){let r=e.props[n];if(vr(r)&&(r=r()),typeof r=="object"&&r!==null&&t in r){const i=Jt(r,t);return i&&!i.configurable&&(i.configurable=!0),i}}},has(e,t){if(t===jt||t===is)return!1;for(let n of e.props)if(vr(n)&&(n=n()),n!=null&&t in n)return!0;return!1},ownKeys(e){const t=[];for(let n of e.props)if(vr(n)&&(n=n()),!!n){for(const r in n)t.includes(r)||t.push(r);for(const r of Object.getOwnPropertySymbols(n))t.includes(r)||t.push(r)}return t}};function ke(...e){return new Proxy({props:e},Mc)}function oe(e,t,n,r){var K;var i=!lr||(n&rl)!==0,s=(n&al)!==0,o=(n&sl)!==0,l=r,c=!0,u=void 0,d=()=>o&&i?(u??(u=nr(r)),a(u)):(c&&(c=!1,l=o?M(r):r),l);let h;if(s){var f=jt in e||is in e;h=((K=Jt(e,t))==null?void 0:K.set)??(f&&t in e?k=>e[t]=k:void 0)}var p,g=!1;s?[p,g]=yl(()=>e[t]):p=e[t],p===void 0&&r!==void 0&&(p=d(),h&&(i&&Ko(),h(p)));var b;if(i?b=()=>{var k=e[t];return k===void 0?d():(c=!0,k)}:b=()=>{var k=e[t];return k!==void 0&&(l=void 0),k===void 0?l:k},i&&(n&il)===0)return b;if(h){var _=e.$$legacy;return(function(k,T){return arguments.length>0?((!i||!T||_||g)&&h(T?b():k),k):b()})}var E=!1,A=((n&nl)!==0?nr:Ut)(()=>(E=!1,b()));s&&a(A);var P=W;return(function(k,T){if(arguments.length>0){const N=T?a(A):i&&s?Hn(k):k;return m(A,N),E=!0,l!==void 0&&(l=N),k}return tn&&E||(P.f&dt)!==0?A.v:a(A)})}function ua(e){ve===null&&Zi(),lr&&ve.l!==null?Dc(ve).m.push(e):ji(()=>{const t=M(e);if(typeof t=="function")return t})}function Cc(e){ve===null&&Zi(),ua(()=>()=>M(e))}function Pc(e,t,{bubbles:n=!1,cancelable:r=!1}={}){return new CustomEvent(e,{detail:t,bubbles:n,cancelable:r})}function di(){const e=ve;return e===null&&Zi(),(t,n,r)=>{var s;const i=(s=e.s.$$events)==null?void 0:s[t];if(i){const o=Mr(i)?i.slice():[i],l=Pc(t,n,r);for(const c of o)c.call(e.x,l);return!l.defaultPrevented}return!0}}function Dc(e){var t=e.l;return t.u??(t.u={a:[],b:[],m:[]})}const Oc="modulepreload",Rc=function(e){return"/"+e},Ra={},Lc=function(t,n,r){let i=Promise.resolve();if(n&&n.length>0){let o=function(u){return Promise.all(u.map(d=>Promise.resolve(d).then(h=>({status:"fulfilled",value:h}),h=>({status:"rejected",reason:h}))))};document.getElementsByTagName("link");const l=document.querySelector("meta[property=csp-nonce]"),c=(l==null?void 0:l.nonce)||(l==null?void 0:l.getAttribute("nonce"));i=o(n.map(u=>{if(u=Rc(u),u in Ra)return;Ra[u]=!0;const d=u.endsWith(".css"),h=d?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${u}"]${h}`))return;const f=document.createElement("link");if(f.rel=d?"stylesheet":Oc,d||(f.as="script"),f.crossOrigin="",f.href=u,c&&f.setAttribute("nonce",c),document.head.appendChild(f),d)return new Promise((p,g)=>{f.addEventListener("load",p),f.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${u}`)))})}))}function s(o){const l=new Event("vite:preloadError",{cancelable:!0});if(l.payload=o,window.dispatchEvent(l),!l.defaultPrevented)throw o}return i.then(o=>{for(const l of o||[])l.status==="rejected"&&s(l.reason);return t().catch(s)})},zc="5";var Xa;typeof window<"u"&&((Xa=window.__svelte??(window.__svelte={})).v??(Xa.v=new Set)).add(zc);ml();/**
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
 */const Uc={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var Fc=new Set(["$$slots","$$events","$$legacy","name","color","size","strokeWidth","absoluteStrokeWidth","iconNode","children"]),jc=lc("<svg><!><!></svg>");function $e(e,t){ee(t,!0);const n=oe(t,"color",3,"currentColor"),r=oe(t,"size",3,24),i=oe(t,"strokeWidth",3,2),s=oe(t,"absoluteStrokeWidth",3,!1),o=oe(t,"iconNode",19,()=>[]),l=be(t,Fc);var c=jc();Pa(c,h=>({...Uc,...l,width:r(),height:r(),stroke:n(),"stroke-width":h,class:["lucide-icon lucide",t.name&&`lucide-${t.name}`,t.class]}),[()=>s()?Number(i())*24/Number(r()):i()]);var u=x(c);fr(u,17,o,la,(h,f)=>{var p=qn(()=>zo(a(f),2));let g=()=>a(p)[0],b=()=>a(p)[1];var _=ue(),E=H(_);pc(E,g,!0,(A,P)=>{Pa(A,()=>({...b()}))}),S(h,_)});var d=$(u);ye(d,()=>t.children??me),S(e,c),te()}var Vc=new Set(["$$slots","$$events","$$legacy"]);function eo(e,t){ee(t,!0);/**
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
 */let n=be(t,Vc);const r=[["path",{d:"M20 6 9 17l-5-5"}]];$e(e,ke({name:"check"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var qc=new Set(["$$slots","$$events","$$legacy"]);function Bc(e,t){ee(t,!0);/**
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
 */let n=be(t,qc);const r=[["path",{d:"m2 2 20 20"}],["path",{d:"M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"}],["path",{d:"M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"}]];$e(e,ke({name:"cloud-off"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var Hc=new Set(["$$slots","$$events","$$legacy"]);function to(e,t){ee(t,!0);/**
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
 */let n=be(t,Hc);const r=[["path",{d:"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"}]];$e(e,ke({name:"cloud"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var Wc=new Set(["$$slots","$$events","$$legacy"]);function no(e,t){ee(t,!0);/**
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
 */let n=be(t,Wc);const r=[["path",{d:"M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"}]];$e(e,ke({name:"command"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var Kc=new Set(["$$slots","$$events","$$legacy"]);function Gc(e,t){ee(t,!0);/**
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
 */let n=be(t,Kc);const r=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]];$e(e,ke({name:"copy"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var Yc=new Set(["$$slots","$$events","$$legacy"]);function Qc(e,t){ee(t,!0);/**
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
 */let n=be(t,Yc);const r=[["path",{d:"M20 4v7a4 4 0 0 1-4 4H4"}],["path",{d:"m9 10-5 5 5 5"}]];$e(e,ke({name:"corner-down-left"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var Jc=new Set(["$$slots","$$events","$$legacy"]);function La(e,t){ee(t,!0);/**
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
 */let n=be(t,Jc);const r=[["path",{d:"M15 3h6v6"}],["path",{d:"M10 14 21 3"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"}]];$e(e,ke({name:"external-link"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var Zc=new Set(["$$slots","$$events","$$legacy"]);function Xc(e,t){ee(t,!0);/**
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
 */let n=be(t,Zc);const r=[["path",{d:"M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"}],["path",{d:"M6.453 15h11.094"}],["path",{d:"M8.5 2h7"}]];$e(e,ke({name:"flask-conical"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var eu=new Set(["$$slots","$$events","$$legacy"]);function tu(e,t){ee(t,!0);/**
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
 */let n=be(t,eu);const r=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2"}],["circle",{cx:"9",cy:"9",r:"2"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]];$e(e,ke({name:"image"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var nu=new Set(["$$slots","$$events","$$legacy"]);function za(e,t){ee(t,!0);/**
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
 */let n=be(t,nu);const r=[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor"}]];$e(e,ke({name:"key-round"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var ru=new Set(["$$slots","$$events","$$legacy"]);function Ur(e,t){ee(t,!0);/**
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
 */let n=be(t,ru);const r=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56"}]];$e(e,ke({name:"loader-circle"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var iu=new Set(["$$slots","$$events","$$legacy"]);function au(e,t){ee(t,!0);/**
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
 */let n=be(t,iu);const r=[["path",{d:"m16 17 5-5-5-5"}],["path",{d:"M21 12H9"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}]];$e(e,ke({name:"log-out"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var su=new Set(["$$slots","$$events","$$legacy"]);function ou(e,t){ee(t,!0);/**
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
 */let n=be(t,su);const r=[["path",{d:"M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"}],["path",{d:"M10 19v-3.96 3.15"}],["path",{d:"M7 19h5"}],["rect",{width:"6",height:"10",x:"16",y:"12",rx:"2"}]];$e(e,ke({name:"monitor-smartphone"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var lu=new Set(["$$slots","$$events","$$legacy"]);function cu(e,t){ee(t,!0);/**
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
 */let n=be(t,lu);const r=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"}]];$e(e,ke({name:"moon"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var uu=new Set(["$$slots","$$events","$$legacy"]);function fu(e,t){ee(t,!0);/**
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
 */let n=be(t,uu);const r=[["path",{d:"M5 12h14"}],["path",{d:"M12 5v14"}]];$e(e,ke({name:"plus"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var du=new Set(["$$slots","$$events","$$legacy"]);function vu(e,t){ee(t,!0);/**
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
 */let n=be(t,du);const r=[["path",{d:"m13.5 8.5-5 5"}],["path",{d:"m8.5 8.5 5 5"}],["circle",{cx:"11",cy:"11",r:"8"}],["path",{d:"m21 21-4.3-4.3"}]];$e(e,ke({name:"search-x"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var hu=new Set(["$$slots","$$events","$$legacy"]);function pu(e,t){ee(t,!0);/**
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
 */let n=be(t,hu);const r=[["path",{d:"m21 21-4.34-4.34"}],["circle",{cx:"11",cy:"11",r:"8"}]];$e(e,ke({name:"search"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var mu=new Set(["$$slots","$$events","$$legacy"]);function gu(e,t){ee(t,!0);/**
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
 */let n=be(t,mu);const r=[["path",{d:"M14 17H5"}],["path",{d:"M19 7h-9"}],["circle",{cx:"17",cy:"17",r:"3"}],["circle",{cx:"7",cy:"7",r:"3"}]];$e(e,ke({name:"settings-2"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var _u=new Set(["$$slots","$$events","$$legacy"]);function fa(e,t){ee(t,!0);/**
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
 */let n=be(t,_u);const r=[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"}],["path",{d:"M20 2v4"}],["path",{d:"M22 4h-4"}],["circle",{cx:"4",cy:"20",r:"2"}]];$e(e,ke({name:"sparkles"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var yu=new Set(["$$slots","$$events","$$legacy"]);function bu(e,t){ee(t,!0);/**
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
 */let n=be(t,yu);const r=[["path",{d:"M10 11v6"}],["path",{d:"M14 11v6"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{d:"M3 6h18"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]];$e(e,ke({name:"trash-2"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var wu=new Set(["$$slots","$$events","$$legacy"]);function xu(e,t){ee(t,!0);/**
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
 */let n=be(t,wu);const r=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{d:"M12 9v4"}],["path",{d:"M12 17h.01"}]];$e(e,ke({name:"triangle-alert"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}var Su=new Set(["$$slots","$$events","$$legacy"]);function vi(e,t){ee(t,!0);/**
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
 */let n=be(t,Su);const r=[["path",{d:"M18 6 6 18"}],["path",{d:"m6 6 12 12"}]];$e(e,ke({name:"x"},()=>n,{get iconNode(){return r},children:(i,s)=>{var o=ue(),l=H(o);ye(l,()=>t.children??me),S(i,o)},$$slots:{default:!0}})),te()}function da(e){const t=e.search(/\s/);return t<0?{title:e.trim(),body:"",hasBodySeparator:!1}:{title:e.slice(0,t).trim(),body:e.slice(t+1).replace(/^\s+/,"").trimEnd(),hasBodySeparator:!0}}function ro(e){return e.isComposing||e.keyCode===229}function Xt(e){return e.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g," ").trim()}function io(e,t){const n=Xt(t),r=e.split(/\r?\n/).map(i=>i.trim()).filter(Boolean);return n?r.find(i=>Xt(i).includes(n))??r[0]??"":r[0]??""}function Ki(e,t,n,r=180){const i=`${e}
${t}`.trim(),s=io(i,n)||i;return s.length<=r?s:`${s.slice(0,r).trimEnd()}…`}function Ua(e,t=2){const n=Xt(e).replace(/\s/g,""),r=new Map;if(n.length<t)return n&&r.set(n,1),r;for(let i=0;i<=n.length-t;i+=1){const s=n.slice(i,i+t);r.set(s,(r.get(s)??0)+1)}return r}function Eu(e,t){if(e.size===0||t.size===0)return 0;let n=0,r=0,i=0;for(const s of e.values())r+=s*s;for(const s of t.values())i+=s*s;for(const[s,o]of e)n+=o*(t.get(s)??0);return r===0||i===0?0:n/(Math.sqrt(r)*Math.sqrt(i))}function ku(e,t){const n=new Map;return e.forEach((r,i)=>{n.set(r.note.id,{...r,lexicalRank:i+1,score:Ai(i+1,1)})}),t.forEach((r,i)=>{const s=n.get(r.note.id);if(s){n.set(r.note.id,{...s,matchType:"both",semanticRank:i+1,score:s.score+Ai(i+1,.72)});return}n.set(r.note.id,{...r,semanticRank:i+1,score:Ai(i+1,.72)})}),[...n.values()].sort((r,i)=>i.score-r.score)}function Ai(e,t){return t/(60+e)}function Fa(e,t=Date.now()){const n=Math.max(0,Math.floor((t-e)/1e3));return n<45?"刚刚":n<3600?`${Math.floor(n/60)} 分钟前`:n<86400?`${Math.floor(n/3600)} 小时前`:n<604800?`${Math.floor(n/86400)} 天前`:new Intl.DateTimeFormat("zh-CN",{month:"short",day:"numeric",year:new Date(e).getFullYear()===new Date(t).getFullYear()?void 0:"numeric"}).format(e)}const va="notesflash.connection.v1";class Bt extends Error{constructor(t,n,r,i){super(t),this.status=n,this.code=r,this.payload=i,this.name="ApiError"}}function $u(){try{const e=localStorage.getItem(va);return e?JSON.parse(e):null}catch{return null}}function Nu(e){localStorage.setItem(va,JSON.stringify(e))}function Au(){localStorage.removeItem(va)}async function Tu(e,t,n){const r=Ou(e),i=await fetch(`${r}/api/devices/pair`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:t.trim(),deviceName:n,platform:Ru()})}),s=await ao(i);if(!i.ok)throw so(i,s);const o=s,l=o.token??o.accessToken;if(!l||!o.instanceId)throw new Bt("配对响应缺少必要字段。",500,"INVALID_PAIRING_RESPONSE",s);return{endpoint:r,token:l,instanceId:o.instanceId,deviceId:o.deviceId}}class ja{constructor(t){this.connection=t}async logout(){const t=new AbortController,n=window.setTimeout(()=>t.abort(),4e3);try{await this.request("/api/auth/logout",{method:"POST",signal:t.signal})}finally{window.clearTimeout(n)}}async createPairingCode(){const t=await this.request("/api/pairing-codes",{method:"POST"});return Pu(t)}async listNotes(t,n){const r=[];let i=0;for(let s=0;s<1e3;s+=1){const o=await this.request(`/api/notes?sort=${encodeURIComponent(t)}&limit=100&offset=${i}`),l=Array.isArray(o)?o:Va(o,"notes");r.push(...l.map(u=>this.mapNote(u))),n==null||n([...r]);const c=qr(Qt(o).nextOffset);if(c===void 0||c<=i||l.length===0)break;i=c}return r}async createNote(t){const n=await this.request("/api/notes",{method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(t)});return this.mapNote(Ti(n,"note"))}async updateNote(t,n){const r=await this.request(`/api/notes/${encodeURIComponent(t)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(n)});return this.mapNote(Ti(r,"note"))}async deleteNote(t,n){await this.request(`/api/notes/${encodeURIComponent(t)}?baseVersion=${n}`,{method:"DELETE"})}async lexicalSearch(t){const n=await this.request(`/api/search/lexical?q=${encodeURIComponent(t)}`);return this.mapHits(n,"lexical")}async semanticSearch(t){const n=await this.request("/api/search/semantic",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:t,limit:30})});return this.mapHits(n,"semantic")}async uploadImage(t){const n=new FormData;n.set("file",t);const r=await this.request("/api/images",{method:"POST",body:n});return this.mapImage(Ti(r,"image"))}async request(t,n={}){const r=new Headers(n.headers);r.set("authorization",`Bearer ${this.connection.token}`),r.set("accept","application/json");const i=await fetch(`${this.connection.endpoint}${t}`,{...n,headers:r,cache:"no-store"}),s=await ao(i);if(!i.ok)throw so(i,s);return s}mapHits(t,n){return(Array.isArray(t)?t:Va(t,"results")).map((i,s)=>{const o=Qt(i),l=this.mapNote(o.note??o);return{note:l,matchType:o.matchType==="both"?"both":n,snippet:typeof o.snippet=="string"?o.snippet:Ki(l.title,l.body,""),score:qa(o.score,1/(s+1))}})}mapNote(t){const n=Qt(t),r=Array.isArray(n.images)?n.images:[];return{id:Rt(n.id),title:Rt(n.title),body:Rt(n.body??n.content),images:r.map(i=>this.mapImage(i)),version:qa(n.version,1),createdAt:Ba(n.createdAt??n.created_at),updatedAt:Ba(n.updatedAt??n.updated_at),embeddingStatus:zu(n.embeddingStatus??n.embedding_status)}}mapImage(t){const n=Qt(t),r=Rt(n.url??n.objectUrl??n.object_url);return{id:Rt(n.id),url:r.startsWith("/")?`${this.connection.endpoint}${r}`:r,name:Rt(n.name??n.filename,"图片"),mimeType:Rt(n.mimeType??n.mime_type,"image/*"),width:qr(n.width),height:qr(n.height),size:qr(n.size)}}}class Iu{constructor(){We(this,"notes",Mu());We(this,"images",new Map);for(const t of this.notes)for(const n of t.images)this.images.set(n.id,n)}async logout(){}async createPairingCode(){return await Wa(180),{code:Du(),expiresAt:Date.now()+600*1e3}}async listNotes(t,n){const r=Cu(this.notes.map(jn),t);return n==null||n(r),r}async createNote(t){const n=Date.now(),r={id:crypto.randomUUID(),title:t.title,body:t.body,images:(t.imageIds??[]).map(i=>this.images.get(i)).filter(Ha),version:1,createdAt:n,updatedAt:n,embeddingStatus:"pending"};return this.notes.unshift(r),window.setTimeout(()=>{const i=this.notes.find(s=>s.id===r.id);i&&(i.embeddingStatus="ready")},900),jn(r)}async updateNote(t,n){const r=this.notes.find(i=>i.id===t);if(!r)throw new Bt("找不到这条笔记。",404,"NOTE_NOT_FOUND");if(r.version!==n.baseVersion)throw new Bt("这条笔记已经在另一处被修改。",409,"VERSION_CONFLICT",{serverNote:jn(r)});return r.title=n.title,r.body=n.body,r.images=(n.imageIds??[]).map(i=>this.images.get(i)).filter(Ha),r.version+=1,r.updatedAt=Date.now(),r.embeddingStatus="pending",window.setTimeout(()=>{const i=this.notes.find(s=>s.id===t);i&&i.version===r.version&&(i.embeddingStatus="ready")},900),jn(r)}async deleteNote(t,n){const r=this.notes.find(i=>i.id===t);if(r){if(r.version!==n)throw new Bt("版本冲突。",409,"VERSION_CONFLICT");this.notes=this.notes.filter(i=>i.id!==t)}}async lexicalSearch(t){const n=Xt(t);if(!n)return[];const r=[];for(const i of this.notes){const s=Xt(i.title),o=Xt(i.body),l=s.indexOf(n),c=o.indexOf(n);if(l<0&&c<0)continue;const u=(s===n?100:0)+(l===0?60:l>=0?35:0)+(c>=0?20:0)+Math.max(0,8-Math.floor((Date.now()-i.updatedAt)/864e5));r.push({note:jn(i),matchType:"lexical",snippet:Ki(i.title,i.body,t),score:u})}return r.sort((i,s)=>s.score-i.score)}async semanticSearch(t){const n=Ua(t);return await Wa(180),this.notes.map(r=>{const i=Eu(n,Ua(`${r.title} ${r.body}`));return{note:jn(r),matchType:"semantic",snippet:Ki(r.title,r.body,t),score:i}}).filter(r=>r.score>.08).sort((r,i)=>i.score-r.score).slice(0,20)}async uploadImage(t){const[n,r]=await Promise.all([Uu(t),Fu(t)]),i={id:crypto.randomUUID(),url:r,name:t.name,mimeType:t.type,size:t.size,...n};return this.images.set(i.id,i),i}}function Mu(){const e=Date.now(),t={id:"demo-image-layout",url:"/icons/notesflash-512.png",name:"NotesFlash 图标",mimeType:"image/png",width:512,height:512,size:18432};return[{id:crypto.randomUUID(),title:"Cloudflare 后端部署",body:`点击 Deploy to Cloudflare 后，Worker、D1、R2、Vectorize 和 Queue 会在用户自己的账号中创建。
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
4. 图片粘贴后立刻预览`,images:[],version:1,createdAt:e-1e3*60*60*30,updatedAt:e-1e3*60*3,embeddingStatus:"ready"}]}function Cu(e,t){return e.sort((n,r)=>t==="title_asc"?n.title.localeCompare(r.title,"zh-CN"):t==="created_desc"?r.createdAt-n.createdAt:r.updatedAt-n.updatedAt)}function jn(e){return{...e,images:e.images.map(t=>({...t}))}}function Pu(e){const t=Qt(e),n=Rt(t.code).trim().toUpperCase(),r=Lu(t.expiresAt??t.expires_at);if(!n||r===void 0)throw new Bt("配对码响应缺少必要字段。",500,"INVALID_PAIRING_CODE_RESPONSE",e);return{code:n,expiresAt:r}}function Du(){const e="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",t=crypto.getRandomValues(new Uint8Array(10)),n=Array.from(t,r=>e[r%e.length]);return`NF-${n.slice(0,5).join("")}-${n.slice(5).join("")}`}function Ou(e){const t=e.trim().replace(/\/+$/,"");if(!/^https?:\/\//i.test(t))throw new Bt("Worker 地址必须以 https:// 开头。",400);return t}function Ru(){return"__TAURI_INTERNALS__"in window?"macos":window.matchMedia("(display-mode: standalone)").matches?"pwa":/iPhone|iPad|iPod/i.test(navigator.userAgent)?"ios-web":"web"}async function ao(e){const t=await e.text();if(!t)return null;try{return JSON.parse(t)}catch{return t}}function so(e,t){const n=Qt(t),r=Qt(n.error),i=Rt(r.message??n.message,`请求失败（${e.status}）`),s=Rt(r.code??n.code,void 0);return new Bt(i,e.status,s,t)}function Va(e,t){const n=Qt(e)[t];return Array.isArray(n)?n:[]}function Ti(e,t){return Qt(e)[t]??e}function Qt(e){return e&&typeof e=="object"?e:{}}function Rt(e,t=""){return typeof e=="string"?e:t}function qa(e,t=0){return typeof e=="number"&&Number.isFinite(e)?e:t}function qr(e){return typeof e=="number"&&Number.isFinite(e)?e:void 0}function Ba(e){if(typeof e=="number")return e;if(typeof e=="string"){const t=Number(e);if(Number.isFinite(t))return t;const n=Date.parse(e);if(Number.isFinite(n))return n}return Date.now()}function Lu(e){if(typeof e=="number"&&Number.isFinite(e))return e;if(typeof e=="string"){const t=Number(e);if(Number.isFinite(t))return t;const n=Date.parse(e);if(Number.isFinite(n))return n}}function zu(e){return e==="disabled"||e==="pending"||e==="processing"||e==="ready"||e==="failed"?e:"pending"}function Ha(e){return!!e}function Wa(e){return new Promise(t=>window.setTimeout(t,e))}function Uu(e){return new Promise(t=>{const n=new Image,r=URL.createObjectURL(e);n.onload=()=>{t({width:n.naturalWidth,height:n.naturalHeight}),URL.revokeObjectURL(r)},n.onerror=()=>{t({}),URL.revokeObjectURL(r)},n.src=r})}function Fu(e){return new Promise((t,n)=>{const r=new FileReader;r.onload=()=>t(String(r.result)),r.onerror=()=>n(r.error??new Error("无法读取图片。")),r.readAsDataURL(e)})}var ju=z('<a class="btn btn-ghost btn-sm mb-3 w-full gap-2" target="_blank" rel="noreferrer">首次部署：打开一次性初始化页面 <!></a>'),Vu=z('<div class="alert alert-error py-2 text-sm" role="alert"><span> </span></div>'),qu=z('<main class="app-shell flex items-center justify-center py-8"><section class="surface w-full max-w-lg rounded-box p-5 shadow-sm sm:p-7"><div class="mb-6 flex items-start gap-4"><div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-content"><!></div> <div><h1 class="text-xl font-semibold tracking-[-0.02em]">连接你的 NotesFlash Cloud</h1> <p class="mt-1 text-sm leading-6 text-base-content/58">笔记保存在你自己的 Cloudflare。这个设备只保存连接信息，不缓存正文。</p></div></div> <a class="btn btn-outline mb-5 w-full gap-2" target="_blank" rel="noreferrer"><!> 一键部署到 Cloudflare <!></a> <div class="rounded-box bg-base-200/55 p-3 text-xs leading-5 text-base-content/58"><p class="font-medium text-base-content/75">配对码从哪里获取？</p> <p class="mt-1">第一次部署后打开 Worker 的 <span class="font-mono">/setup</span>，点击初始化即可直接看到首个一次性配对码，不需要填写额外的环境变量。</p> <p class="mt-1">以后添加设备，请在任意已连接设备的「设置」中生成新码；初始化完成后，匿名网页不能再次发码。</p></div> <div class="divider my-4 text-[11px] text-base-content/35">填写地址与配对码</div> <!> <form class="space-y-3"><label class="form-control block"><span class="label pb-1.5 text-xs text-base-content/60">Worker 地址</span> <input class="input input-bordered w-full bg-base-100" placeholder="https://notesflash-example.workers.dev" inputmode="url" autocomplete="url" required=""/></label> <div class="grid gap-3 sm:grid-cols-2"><label class="form-control block"><span class="label pb-1.5 text-xs text-base-content/60">一次性配对码</span> <input class="input input-bordered w-full bg-base-100 font-mono uppercase tracking-widest" placeholder="ABCD-1234" autocomplete="one-time-code" required=""/></label> <label class="form-control block"><span class="label pb-1.5 text-xs text-base-content/60">设备名称</span> <input class="input input-bordered w-full bg-base-100" required=""/></label></div> <!> <button class="btn btn-primary mt-2 w-full" type="submit"><!> 连接这个设备</button></form> <button type="button" class="btn btn-ghost mt-3 w-full gap-2 text-base-content/55"><!> 先使用不落盘的演示模式</button></section></main>');function Bu(e,t){ee(t,!1);const n=O(),r=di(),i="https://deploy.workers.cloudflare.com/?url=https://github.com/realllllty/notesflash/tree/main/cloud";let s=O(f()),o=O(""),l=O(h()),c=O(!1),u=O("");async function d(){m(c,!0),m(u,"");try{r("connected",await Tu(a(s),a(o),a(l)))}catch(Z){m(u,Z instanceof Bt||Z instanceof Error?Z.message:"连接失败")}finally{m(c,!1)}}function h(){return"__TAURI_INTERNALS__"in window?"NotesFlash Mac":`NotesFlash ${navigator.userAgent.includes("Mac")?"Mac":navigator.userAgent.includes("iPhone")?"iPhone":"浏览器"}`}function f(){return"__TAURI_INTERNALS__"in window?"":/^https?:$/.test(window.location.protocol)?window.location.origin:""}ft(()=>a(s),()=>{m(n,/^https?:\/\//i.test(a(s).trim())?`${a(s).trim().replace(/\/+$/,"")}/setup`:"")}),gn(),nn();var p=qu(),g=x(p),b=x(g),_=x(b),E=x(_);ou(E,{size:23});var A=$(b,2);Se(A,"href",i);var P=x(A);to(P,{size:17});var K=$(P,2);La(K,{size:14,class:"opacity-55"});var k=$(A,6);{var T=Z=>{var Fe=ju(),R=$(x(Fe));La(R,{size:13,class:"opacity-55"}),le(()=>Se(Fe,"href",a(n))),S(Z,Fe)};Q(k,Z=>{a(n)&&Z(T)})}var N=$(k,2),F=x(N),V=$(x(F),2),J=$(F,2),ge=x(J),ie=$(x(ge),2),we=$(ge,2),Te=$(x(we),2),Ne=$(J,2);{var fe=Z=>{var Fe=Vu(),R=x(Fe),ae=x(R);le(()=>pe(ae,a(u))),S(Z,Fe)};Q(Ne,Z=>{a(u)&&Z(fe)})}var Ae=$(Ne,2),he=x(Ae);{var de=Z=>{Ur(Z,{size:17,class:"animate-spin"})};Q(he,Z=>{a(c)&&Z(de)})}var qe=$(N,2),Ye=x(qe);Xc(Ye,{size:16}),le(()=>Ae.disabled=a(c)),Jr(V,()=>a(s),Z=>m(s,Z)),Jr(ie,()=>a(o),Z=>m(o,Z)),Jr(Te,()=>a(l),Z=>m(l,Z)),Y("submit",N,Tc(d)),Y("click",qe,()=>r("demo")),S(e,p),te()}const Hu=/^\[\[notesflash-image:([A-Za-z0-9_-]+)\]\]$/;function Wu(e){return`[[notesflash-image:${e}]]`}function Gi(e,t){const n=new Map(t.map(l=>[l.id,l])),r=new Set,i=[],s=[],o=()=>{i.push({key:crypto.randomUUID(),type:"text",text:s.join(`
`)}),s.length=0};for(const l of e.split(`
`)){const c=l.match(Hu),u=c?n.get(c[1]):void 0;if(!c||!u){s.push(l);continue}o(),i.push({key:crypto.randomUUID(),type:"image",image:u}),r.add(u.id)}o();for(const l of t)r.has(l.id)||(i.push({key:crypto.randomUUID(),type:"image",image:l}),i.push({key:crypto.randomUUID(),type:"text",text:""}));return i}function Ka(e){return e.map(t=>t.type==="text"?t.text:Wu(t.image.id)).join(`
`)}function Ga(e){return e.flatMap(t=>t.type==="image"?[t.image]:[])}var Ku=z("<mark> </mark>");function Ya(e,t){ee(t,!1);const n=O();let r=oe(t,"text",8,""),i=oe(t,"query",8,"");function s(c,u){const d=Xt(u);if(!d)return[{value:c,match:!1}];const h=c.normalize("NFKC").toLocaleLowerCase(),f=[];let p=0,g=h.indexOf(d,p);for(;g>=0;)g>p&&f.push({value:c.slice(p,g),match:!1}),f.push({value:c.slice(g,g+u.length),match:!0}),p=g+u.length,g=h.indexOf(d,p);return p<c.length&&f.push({value:c.slice(p),match:!1}),f.length>0?f:[{value:c,match:!1}]}ft(()=>(_e(r()),_e(i())),()=>{m(n,s(r(),i()))}),gn(),nn();var o=ue(),l=H(o);fr(l,1,()=>a(n),la,(c,u)=>{var d=ue(),h=H(d);{var f=g=>{var b=Ku(),_=x(b);le(()=>pe(_,(a(u),M(()=>a(u).value)))),S(g,b)},p=g=>{var b=En();le(()=>pe(b,(a(u),M(()=>a(u).value)))),S(g,b)};Q(h,g=>{a(u),M(()=>a(u).match)?g(f):g(p,-1)})}S(c,d)}),S(e,o),te()}var Gu=z('<button type="button" class="group relative overflow-hidden rounded-box border border-base-300 bg-base-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><img class="aspect-[4/3] h-full w-full object-cover transition duration-150 group-hover:scale-[1.02]" loading="lazy"/></button>'),Yu=z('<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"></div>'),Qu=z('<div class="fixed inset-0 z-50 flex items-center justify-center bg-neutral/80 p-4 backdrop-blur-sm" role="presentation"><button type="button" class="btn btn-circle btn-sm absolute right-4 top-[calc(1rem+var(--safe-top))] border-0 bg-base-100/90" aria-label="关闭图片"><!></button> <button type="button" class="max-h-[88vh] max-w-full" aria-label="保持查看图片"><img class="max-h-[88vh] max-w-full rounded-box object-contain shadow-2xl"/></button></div>'),Ju=z("<!> <!>",1);function Zu(e,t){ee(t,!1);let n=oe(t,"images",24,()=>[]),r=O(null);nn();var i=Ju(),s=H(i);{var o=u=>{var d=Yu();fr(d,5,n,la,(h,f)=>{var p=Gu(),g=x(p);le(()=>{Se(p,"aria-label",(a(f),M(()=>`查看图片 ${a(f).name}`))),Se(g,"src",(a(f),M(()=>a(f).url))),Se(g,"alt",(a(f),M(()=>a(f).name)))}),Y("click",p,()=>m(r,a(f))),S(h,p)}),S(u,d)};Q(s,u=>{_e(n()),M(()=>n().length>0)&&u(o)})}var l=$(s,2);{var c=u=>{var d=Qu(),h=x(d),f=x(h);vi(f,{size:17});var p=$(h,2),g=x(p);le(()=>{Se(g,"src",(a(r),M(()=>a(r).url))),Se(g,"alt",(a(r),M(()=>a(r).name)))}),Y("click",h,()=>m(r,null)),Y("click",p,Ac(function(b){Xs.call(this,t,b)})),Y("click",d,()=>m(r,null)),Y("keydown",d,b=>b.key==="Escape"&&m(r,null)),S(u,d)};Q(l,u=>{a(r)&&u(c)})}S(e,i),te()}var Xu=z('<span class="inline-flex items-center gap-1 text-primary/62"><!> </span>'),ef=z('<span class="inline-flex items-center gap-1"><!> </span>'),tf=z('<div class="note-prose min-h-6 cursor-text text-[14px] text-base-content/72 outline-none svelte-1ib1l1a" role="button" tabindex="0"><!></div>'),nf=z('<article><header class="mb-2 flex items-start gap-3"><div class="min-w-0 flex-1 cursor-text text-left outline-none svelte-1ib1l1a" role="button" tabindex="0"><h2 class="break-words text-[15px] font-semibold leading-6 tracking-[-0.01em]"><!></h2> <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-base-content/38"><time> </time> <!> <!></div></div></header> <div></div></article>');function rf(e,t){ee(t,!1);const n=O();let r=oe(t,"hit",8),i=oe(t,"query",8,""),s=oe(t,"selected",8,!1),o=oe(t,"optionIndex",8,0);const l=di();ft(()=>_e(r()),()=>{m(n,Gi(r().note.body,r().note.images))}),gn(),nn();var c=nf();let u;var d=x(c),h=x(d),f=x(h),p=x(f);{let T=Ut(()=>(_e(r()),M(()=>r().note.title||"无标题")));Ya(p,{get text(){return a(T)},get query(){return i()}})}var g=$(f,2),b=x(g),_=x(b),E=$(b,2);{var A=T=>{var N=Xu(),F=x(N);fa(F,{size:11});var V=$(F);le(()=>pe(V,` ${_e(r()),M(()=>r().matchType==="both"?"关键词 + 语义":"语义相关")??""}`)),S(T,N)};Q(E,T=>{_e(r()),M(()=>r().matchType==="semantic"||r().matchType==="both")&&T(A)})}var P=$(E,2);{var K=T=>{var N=ef(),F=x(N);tu(F,{size:11});var V=$(F);le(()=>pe(V,` ${_e(r()),M(()=>r().note.images.length)??""}`)),S(T,N)};Q(P,T=>{_e(r()),M(()=>r().note.images.length>0)&&T(K)})}var k=$(d,2);fr(k,5,()=>a(n),T=>T.key,(T,N)=>{var F=ue(),V=H(F);{var J=ie=>{var we=tf(),Te=x(we);{var Ne=fe=>{Ya(fe,{get text(){return a(N),M(()=>a(N).text)},get query(){return i()}})};Q(Te,fe=>{a(N),M(()=>a(N).text)&&fe(Ne)})}le(()=>Se(we,"aria-label",(_e(r()),M(()=>`编辑 ${r().note.title} 的正文`)))),Y("click",we,()=>l("edit")),Y("keydown",we,fe=>(fe.key==="Enter"||fe.key===" ")&&l("edit")),S(ie,we)},ge=ie=>{{let we=Ut(()=>(a(N),M(()=>[a(N).image])));Zu(ie,{get images(){return a(we)}})}};Q(V,ie=>{a(N),M(()=>a(N).type==="text")?ie(J):(a(N),M(()=>a(N).type==="image")&&ie(ge,1))})}S(T,F)}),le(T=>{Se(c,"id",`search-option-${o()}`),u=ca(c,1,"note-card scroll-mt-24 px-3 py-4 sm:px-4 svelte-1ib1l1a",null,u,{selected:s()}),Se(c,"aria-current",s()?"true":void 0),Se(h,"aria-label",(_e(r()),M(()=>`编辑 ${r().note.title}`))),pe(_,T)},[()=>(_e(Fa),_e(r()),M(()=>Fa(r().note.updatedAt)))]),Y("click",h,()=>l("edit")),Y("keydown",h,T=>(T.key==="Enter"||T.key===" ")&&l("edit")),S(e,c),te()}var af=z('<span class="inline-flex items-center gap-1"><!> </span>'),sf=z('<span class="inline-flex items-center gap-1 text-error"><!> 保存失败</span>'),of=z('<span class="inline-flex items-center gap-1"><!> 已自动保存</span>'),lf=z('<textarea data-note-body="" class="note-body-input block min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[14px] leading-[1.68] outline-none placeholder:text-base-content/30 focus:outline-none svelte-1cddmxz" aria-label="笔记正文"></textarea>'),cf=z('<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><figure class="group relative overflow-hidden rounded-box border border-base-300 bg-base-200"><img class="aspect-[4/3] h-full w-full object-cover"/> <button type="button" class="btn btn-circle btn-xs absolute right-2 top-2 border-0 bg-base-100/90 opacity-70 shadow-sm transition hover:opacity-100"><!></button></figure></div>'),uf=z('<p class="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error"> </p>'),ff=z('<section class="note-editor relative scroll-mt-24 px-3 py-4 sm:px-4"><button type="button" class="btn btn-ghost btn-xs absolute right-3 top-4 z-10 gap-1 text-error/75 sm:right-4"><!> 删除</button> <header class="mb-2 flex items-start gap-3 pr-14"><div class="min-w-0 flex-1"><input class="note-title-input block w-full bg-transparent text-[15px] font-semibold leading-6 tracking-[-0.01em] outline-none placeholder:text-base-content/35 svelte-1cddmxz" placeholder="标题" aria-label="笔记标题"/> <div class="mt-1 flex items-center gap-2 text-[11px] text-base-content/42"><!></div></div></header> <div class="text-[14px] leading-7 text-base-content/78"></div> <!></section>');function df(e,t){ee(t,!1);let n=oe(t,"note",8),r=oe(t,"saveNote",8),i=oe(t,"deleteNote",8),s=oe(t,"uploadImage",8),o=oe(t,"close",8),l=O(n().title),c=O(Gi(n().body,n().images)),u=n().version,d=O(n().id),h=O("saved"),f=O(""),p=O(!1),g,b=0,_=null,E=null,A=O();ua(()=>{T();const I=D=>{a(h)!=="saved"&&(D.preventDefault(),D.returnValue="")};return window.addEventListener("beforeunload",I),()=>{window.clearTimeout(g),window.removeEventListener("beforeunload",I)}});function P(I){m(d,I.id),m(l,I.title),m(c,Gi(I.body,I.images)),u=I.version,b=0,_=null,m(h,"saved"),m(f,"")}function K(){b+=1,m(h,"dirty"),m(f,""),window.clearTimeout(g),g=window.setTimeout(()=>void N(),650)}async function k(){return E&&!await E?!1:N()}function T(){window.setTimeout(()=>{var D;const I=(D=a(A))==null?void 0:D.querySelector("textarea[data-note-body]");I==null||I.focus({preventScroll:!0})},0)}async function N(){if(window.clearTimeout(g),_)return await _?a(h)==="dirty"?N():a(h)==="saved":!1;if(a(h)==="saved")return!0;const I=b,D=Ga(a(c)),B={baseVersion:u,title:a(l).trim()||"无标题",body:Ka(a(c)),imageIds:D.map(Ie=>Ie.id)};m(h,"saving");const se=(async()=>{try{return u=(await r()(n().id,B)).version,b===I?m(h,"saved"):m(h,"dirty"),!0}catch(Ie){return m(h,"error"),m(f,Ie instanceof Error?Ie.message:"保存失败"),!1}})();_=se;const De=await se;return _===se&&(_=null),De?b!==I?N():!0:!1}function F(I,D){const B=D.currentTarget;m(c,a(c).map(se=>se.key===I&&se.type==="text"?{...se,text:B.value}:se)),K()}async function V(I,D){const B=ie(I.clipboardData);if(B.length===0)return;I.preventDefault();const se=I.currentTarget,De=a(c).findIndex(Qe=>Qe.key===D&&Qe.type==="text"),Ie=a(c)[De];if(De<0||!Ie||Ie.type!=="text")return;const at=se.selectionStart??Ie.text.length,Re=se.selectionEnd??at,Et=Ie.text.slice(0,at),kt=Ie.text.slice(Re);m(p,!0),m(f,"");const st=(async()=>{try{const Qe=[];for(const Ze of B)Qe.push(await s()(Ze));const Je=[{key:crypto.randomUUID(),type:"text",text:Et}];for(const Ze of Qe)Je.push({key:crypto.randomUUID(),type:"image",image:Ze}),Je.push({key:crypto.randomUUID(),type:"text",text:""});const an=Je[Je.length-1];an.type==="text"&&(an.text=kt),m(c,[...a(c).slice(0,De),...Je,...a(c).slice(De+1)]),K();const Ln=an.key;return window.setTimeout(()=>{var sn;const Ze=(sn=a(A))==null?void 0:sn.querySelector(`textarea[data-block-key="${Ln}"]`);Ze==null||Ze.focus({preventScroll:!0}),Ze==null||Ze.setSelectionRange(0,0)},0),!0}catch(Qe){return m(h,"error"),m(f,Qe instanceof Error?Qe.message:"图片上传失败"),!1}finally{m(p,!1)}})();E=st,await st,E===st&&(E=null)}function J(I){const D=a(c).findIndex(De=>De.key===I&&De.type==="image");if(D<0)return;const B=a(c)[D-1],se=a(c)[D+1];if((B==null?void 0:B.type)==="text"&&(se==null?void 0:se.type)==="text"){const De=B.text&&se.text?`
`:"",Ie={key:B.key,type:"text",text:`${B.text}${De}${se.text}`};m(c,[...a(c).slice(0,D-1),Ie,...a(c).slice(D+2)])}else m(c,a(c).filter(De=>De.key!==I));K()}async function ge(){if(window.confirm(`确定删除“${a(l)||"无标题"}”吗？`))try{await i()({...n(),title:a(l),body:Ka(a(c)),images:Ga(a(c)),version:u})}catch(I){m(h,"error"),m(f,I instanceof Error?I.message:"删除失败")}}function ie(I){if(!I)return[];const D=[...I.items].filter(B=>B.kind==="file"&&B.type.startsWith("image/")).map(B=>B.getAsFile()).filter(B=>!!B);return D.length>0?D:[...I.files].filter(B=>B.type.startsWith("image/"))}async function we(){await k()&&o()()}function Te(I){I.key==="Escape"&&(I.preventDefault(),we())}ft(()=>(_e(n()),a(d)),()=>{n().id!==a(d)&&P(n())}),gn();var Ne={flush:k,focusBody:T};nn();var fe=ff(),Ae=x(fe),he=x(Ae);bu(he,{size:13});var de=$(Ae,2),qe=x(de),Ye=x(qe),Z=$(Ye,2),Fe=x(Z);{var R=I=>{var D=af(),B=x(D);Ur(B,{size:12,class:"animate-spin"});var se=$(B);le(()=>pe(se,` ${a(p)?"正在粘贴图片":"保存中"}`)),S(I,D)},ae=I=>{var D=sf(),B=x(D);xu(B,{size:12}),S(I,D)},Be=I=>{var D=of(),B=x(D);eo(B,{size:12}),S(I,D)};Q(Fe,I=>{a(h)==="saving"||a(p)?I(R):a(h)==="error"?I(ae,1):I(Be,-1)})}var St=$(de,2);fr(St,5,()=>a(c),I=>I.key,(I,D)=>{var B=ue(),se=H(B);{var De=at=>{var Re=lf();le(()=>{Se(Re,"data-block-key",(a(D),M(()=>a(D).key))),Js(Re,(a(D),M(()=>a(D).text))),Se(Re,"placeholder",(a(c),M(()=>a(c).length===1?"写下正文，可直接粘贴图片…":""))),Re.readOnly=a(p)}),Y("input",Re,Et=>F(a(D).key,Et)),Y("paste",Re,Et=>void V(Et,a(D).key)),Y("keydown",Re,Te),S(at,Re)},Ie=at=>{var Re=cf(),Et=x(Re),kt=x(Et),st=$(kt,2),Qe=x(st);vi(Qe,{size:13}),le(()=>{Se(kt,"src",(a(D),M(()=>a(D).image.url))),Se(kt,"alt",(a(D),M(()=>a(D).image.name))),Se(st,"aria-label",(a(D),M(()=>`移除图片 ${a(D).image.name}`)))}),Y("click",st,()=>J(a(D).key)),S(at,Re)};Q(se,at=>{a(D),M(()=>a(D).type==="text")?at(De):at(Ie,-1)})}S(I,B)});var rn=$(St,2);{var Ct=I=>{var D=uf(),B=x(D);le(()=>pe(B,a(f))),S(I,D)};Q(rn,I=>{a(f)&&I(Ct)})}return ai(fe,I=>m(A,I),()=>a(A)),Y("click",Ae,ge),Jr(Ye,()=>a(l),I=>m(l,I)),Y("input",Ye,K),Y("keydown",Ye,Te),S(e,fe),Wi(t,"flush",k),Wi(t,"focusBody",T),te(Ne)}var vf=z('<button id="search-option-0" type="button"><span class="create-icon flex size-8 shrink-0 items-center justify-center rounded-lg svelte-1c7qagn"><!></span> <span class="min-w-0 flex-1"><span class="block text-[13px] font-medium tracking-[-0.005em]"> </span> <span class="mt-0.5 block truncate text-[11px] text-base-content/42"><!></span></span> <span class="hidden items-center gap-1 text-[10px] text-base-content/32 group-hover:flex sm:flex"><!> Enter</span></button>');function hf(e,t){ee(t,!1);const n=O();let r=oe(t,"query",8,""),i=oe(t,"selected",8,!1);ft(()=>_e(r()),()=>{m(n,da(r()))}),gn(),nn();var s=vf();let o;var l=x(s),c=x(l);fu(c,{size:17,strokeWidth:1.8});var u=$(l,2),d=x(u),h=x(d),f=$(d,2),p=x(f);{var g=A=>{var P=En();le(()=>pe(P,`正文：${a(n),M(()=>a(n).body||"继续在搜索框中输入正文")??""}`)),S(A,P)},b=A=>{var P=En("按 Space 继续输入正文");S(A,P)};Q(p,A=>{a(n),M(()=>a(n).hasBodySeparator)?A(g):A(b,-1)})}var _=$(u,2),E=x(_);Qc(E,{size:13}),le(()=>{Se(s,"aria-current",i()?"true":void 0),o=ca(s,1,"quick-create group flex w-full items-center gap-3 rounded-box border px-3 py-2.5 text-left svelte-1c7qagn",null,o,{selected:i()}),pe(h,`创建“${a(n),M(()=>a(n).title||"无标题")??""}”`)}),Y("click",s,function(A){Xs.call(this,t,A)}),S(e,s),te()}var pf=z('<span class="tooltip tooltip-bottom" data-tip="正在补充语义结果"><!></span>'),mf=z('<span class="badge badge-ghost badge-sm hidden gap-1 border-base-content/8 bg-base-200/55 text-[10px] font-medium text-base-content/42 sm:inline-flex">AI</span>'),gf=z('<button type="button" class="btn btn-ghost btn-circle btn-xs text-base-content/42 hover:bg-base-200/70" aria-label="清空搜索"><!></button>'),_f=z('<span class="draft-body h-full flex-1 transition-[width] duration-150 svelte-tsg0ih"></span>'),yf=z('<span><strong class="font-medium text-base-content/58">标题</strong> · 按 Space 开始正文</span>'),bf=z('<span class="truncate"><strong class="font-medium text-base-content/58">标题</strong> </span> <span class="ml-auto shrink-0">Space → 正文</span>',1),wf=z('<span class="max-w-[45%] truncate"><strong class="font-medium text-base-content/58">标题</strong> </span> <span class="text-base-content/25">/</span> <span class="min-w-0 flex-1 truncate"><strong class="font-medium text-base-content/58">正文</strong> </span>',1),xf=z('<div class="search-shell surface sticky top-[calc(.75rem+var(--safe-top))] z-30 rounded-box svelte-tsg0ih"><div class="flex items-center gap-2 px-2.5 pb-1 pt-2"><!> <input class="min-w-0 flex-1 bg-transparent px-1 py-2 text-[15px] tracking-[-0.005em] outline-none placeholder:text-base-content/34" type="text" role="searchbox" inputmode="search" autocomplete="off" spellcheck="false" placeholder="输入标题，按空格继续写正文…" aria-label="搜索笔记或快速创建笔记" aria-describedby="quick-draft-hint"/> <!> <!> <button type="button" class="btn btn-ghost btn-circle btn-sm text-base-content/62 hover:bg-base-200/70" aria-label="打开设置"><!></button></div> <div id="quick-draft-hint" class="px-3 pb-2.5" aria-live="polite"><div class="draft-track flex h-0.5 overflow-hidden rounded-full svelte-tsg0ih"><span class="draft-title h-full transition-[width] duration-150 svelte-tsg0ih"></span> <!></div> <div class="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-base-content/40"><!></div></div></div>');function Sf(e,t){ee(t,!1);const n=O(),r=O(),i=O();let s=oe(t,"value",8,""),o=oe(t,"semanticSearching",8,!1),l=oe(t,"semanticEnabled",8,!0),c=oe(t,"selectedIndex",8,0);const u=di();let d=O(),h=O(!1),f=0;function p(){var R,ae;(R=a(d))==null||R.focus(),(ae=a(d))==null||ae.select()}function g(R){u("input",R.currentTarget.value)}function b(R){a(h)||ro(R)||R.key==="Enter"&&performance.now()<f||u("keyaction",R)}function _(){m(h,!1),f=performance.now()+100}ft(()=>_e(s()),()=>{m(n,da(s()))}),ft(()=>a(n),()=>{m(r,Math.max(1,a(n).title.length+a(n).body.length))}),ft(()=>(a(n),a(r)),()=>{m(i,a(n).hasBodySeparator?Math.min(80,Math.max(20,a(n).title.length/a(r)*100)):100)}),gn();var E={focus:p};nn();var A=xf(),P=x(A),K=x(P);pu(K,{size:18,strokeWidth:1.8,class:"ml-0.5 shrink-0 text-base-content/38"});var k=$(K,2);ai(k,R=>m(d,R),()=>a(d));var T=$(k,2);{var N=R=>{var ae=pf(),Be=x(ae);Ur(Be,{size:15,class:"animate-spin text-primary/70"}),S(R,ae)},F=R=>{var ae=mf();S(R,ae)},V=qn(()=>(_e(l()),_e(s()),M(()=>l()&&s().trim())));Q(T,R=>{o()?R(N):a(V)&&R(F,1)})}var J=$(T,2);{var ge=R=>{var ae=gf(),Be=x(ae);vi(Be,{size:15}),Y("click",ae,()=>u("input","")),S(R,ae)};Q(J,R=>{s()&&R(ge)})}var ie=$(J,2),we=x(ie);gu(we,{size:17});var Te=$(P,2),Ne=x(Te),fe=x(Ne),Ae=$(fe,2);{var he=R=>{var ae=_f();S(R,ae)};Q(Ae,R=>{a(n),M(()=>a(n).hasBodySeparator)&&R(he)})}var de=$(Ne,2),qe=x(de);{var Ye=R=>{var ae=yf();S(R,ae)},Z=R=>{var ae=bf(),Be=H(ae),St=$(x(Be));le(()=>pe(St,` ${a(n),M(()=>a(n).title)??""}`)),S(R,ae)},Fe=R=>{var ae=wf(),Be=H(ae),St=$(x(Be)),rn=$(Be,4),Ct=$(x(rn));le(()=>{pe(St,` ${a(n),M(()=>a(n).title||"无标题")??""}`),pe(Ct,` ${a(n),M(()=>a(n).body||"继续输入…")??""}`)}),S(R,ae)};Q(qe,R=>{s()?(a(n),M(()=>!a(n).hasBodySeparator)?R(Z,1):R(Fe,-1)):R(Ye)})}return le(()=>{Se(k,"aria-activedescendant",`search-option-${c()}`),Js(k,s()),Ks(fe,`width: ${s()?a(i):0}%`)}),Y("input",k,g),Y("compositionstart",k,()=>m(h,!0)),Y("compositionend",k,_),Y("keydown",k,b),Y("click",ie,()=>u("settings")),S(e,A),Wi(t,"focus",p),te(E)}async function oo(e){if(!e)return!1;try{return await navigator.clipboard.writeText(e),!0}catch{const t=document.createElement("textarea");t.value=e,t.setAttribute("readonly",""),t.style.position="fixed",t.style.opacity="0",document.body.appendChild(t),t.select();const n=document.execCommand("copy");return t.remove(),n}}var Ef=z("<!> 已复制",1),kf=z("<!> 复制",1),$f=z('<div class="mt-3 rounded-box bg-base-200/70 p-3" aria-live="polite"><div class="flex flex-col gap-2 sm:flex-row sm:items-center"><code class="min-w-0 flex-1 select-all text-center text-lg font-semibold tracking-[0.16em] sm:text-left"> </code> <button class="btn btn-primary btn-sm gap-1.5" type="button"><!></button></div> <p class="mt-2 text-[11px] text-base-content/45"> </p></div>'),Nf=z('<p class="mt-3 text-xs text-warning" aria-live="polite">这个配对码已经过期。</p>'),Af=z('<!> <button class="btn btn-outline btn-sm mt-3 w-full gap-2" type="button"><!> </button>',1),Tf=z('<div class="alert alert-error mt-3 min-h-0 py-2 text-xs" role="alert"><span> </span></div>'),If=z('<section class="mt-3 rounded-box border border-base-300/70 p-3" aria-labelledby="pairing-code-title"><div class="flex items-start gap-3"><!> <div class="min-w-0 flex-1"><h3 id="pairing-code-title" class="text-sm font-medium">连接另一台设备</h3> <p class="mt-0.5 text-xs leading-5 text-base-content/48">生成一个短期、仅可使用一次的配对码。在新设备上填写当前 Worker 地址和这个码即可连接。</p></div></div> <!> <!></section>'),Mf=z('<div class="fixed inset-0 z-40 bg-neutral/25 backdrop-blur-[2px]" role="presentation"></div> <aside class="surface fixed bottom-0 left-1/2 z-50 max-h-[88vh] w-full max-w-xl -translate-x-1/2 overflow-y-auto rounded-t-box p-5 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-box" aria-label="设置"><header class="mb-5 flex items-center justify-between"><div><h2 class="text-lg font-semibold">设置</h2> <p class="text-xs text-base-content/45">尽量保持简单，只控制检索和显示顺序。</p></div> <button class="btn btn-ghost btn-circle btn-sm" aria-label="关闭设置"><!></button></header> <div class="space-y-1"><label class="flex items-center gap-3 rounded-box px-3 py-3 hover:bg-base-200/60"><!> <span class="min-w-0 flex-1"><span class="block text-sm font-medium">笔记排序</span> <span class="block text-xs text-base-content/45">影响无搜索词时的平铺顺序</span></span> <select class="select select-bordered select-sm"><option>最近修改</option><option>最近创建</option><option>标题</option></select></label> <label class="flex cursor-pointer items-center gap-3 rounded-box px-3 py-3 hover:bg-base-200/60"><!> <span class="min-w-0 flex-1"><span class="block text-sm font-medium">语义搜索</span> <span class="block text-xs text-base-content/45">关键词结果不足时，使用余弦相似度补充</span></span> <input type="checkbox" class="toggle toggle-primary toggle-sm"/></label> <div class="flex items-center gap-3 rounded-box px-3 py-3"><!> <span class="min-w-0 flex-1"><span class="block text-sm font-medium">外观</span> <span class="block text-xs text-base-content/45">跟随设备，或固定为浅色 / 深色</span></span> <div class="join"><button class="btn btn-sm join-item">自动</button> <button class="btn btn-sm join-item">浅色</button> <button class="btn btn-sm join-item">深色</button></div></div></div> <div class="divider my-4"></div> <div class="rounded-box bg-base-200/55 p-3"><div class="flex items-center gap-2 text-xs font-medium"><!> </div> <p class="mt-1 break-all text-[11px] leading-5 text-base-content/45"> </p></div> <!> <button class="btn btn-ghost mt-4 w-full gap-2 text-error"><!> </button></aside>',1);function Cf(e,t){ee(t,!1);const n=O();let r=oe(t,"open",8,!1),i=oe(t,"sortMode",8,"updated_desc"),s=oe(t,"semanticEnabled",8,!0),o=oe(t,"demoMode",8,!1),l=oe(t,"endpoint",8,""),c=oe(t,"createPairingCode",8,void 0),u=O(null),d=O(!1),h=O(""),f=O(!1),p=O(Date.now()),g;Cc(()=>window.clearInterval(g));const b=di();function _(N){b("sortchange",N.currentTarget.value)}async function E(){if(!(!c()||a(d))){m(d,!0),m(h,""),m(f,!1);try{m(u,await c()()),m(p,Date.now()),window.clearInterval(g),g=window.setInterval(()=>{m(p,Date.now()),a(u)&&a(u).expiresAt<=a(p)&&window.clearInterval(g)},1e3)}catch(N){m(h,N instanceof Error?N.message:"无法生成配对码，请稍后重试。")}finally{m(d,!1)}}}async function A(){m(f,a(u)?await oo(a(u).code):!1)}function P(N){const F=Math.max(0,Math.ceil((N-a(p))/1e3));if(F===0)return"已过期，请重新生成";const V=Math.floor(F/60),J=F%60;return`${V}:${String(J).padStart(2,"0")} 后过期`}ft(()=>(a(u),a(p)),()=>{m(n,a(u)!==null&&a(u).expiresAt<=a(p))}),gn(),nn();var K=ue(),k=H(K);{var T=N=>{var F=Mf(),V=H(F),J=$(V,2),ge=x(J),ie=$(x(ge),2),we=x(ie);vi(we,{size:17});var Te=$(ge,2),Ne=x(Te),fe=x(Ne);no(fe,{size:18,class:"text-base-content/45"});var Ae=$(fe,4),he=x(Ae);he.value=he.__value="updated_desc";var de=$(he);de.value=de.__value="created_desc";var qe=$(de);qe.value=qe.__value="title_asc";var Ye;Gs(Ae);var Z=$(Ne,2),Fe=x(Z);fa(Fe,{size:18,class:"text-primary/70"});var R=$(Fe,4),ae=$(Z,2),Be=x(ae);cu(Be,{size:18,class:"text-base-content/45"});var St=$(Be,4),rn=x(St),Ct=$(rn,2),I=$(Ct,2),D=$(Te,4),B=x(D),se=x(B);to(se,{size:14});var De=$(se),Ie=$(B,2),at=x(Ie),Re=$(D,2);{var Et=Je=>{var an=If(),Ln=x(an),Ze=x(Ln);za(Ze,{size:17,class:"mt-0.5 shrink-0 text-primary/75"});var sn=$(Ln,2);{var hi=ot=>{var Pt=$f(),Ht=x(Pt),Dt=x(Ht),Xe=x(Dt),on=$(Dt,2),He=x(on);{var _n=Ot=>{var bn=Ef(),dr=H(bn);eo(dr,{size:15}),S(Ot,bn)},yn=Ot=>{var bn=kf(),dr=H(bn);Gc(dr,{size:15}),S(Ot,bn)};Q(He,Ot=>{a(f)?Ot(_n):Ot(yn,-1)})}var je=$(Ht,2),zn=x(je);le(Ot=>{pe(Xe,(a(u),M(()=>a(u).code))),pe(zn,`${Ot??""} · 使用后立即失效，请勿发送给其他人`)},[()=>(a(u),M(()=>P(a(u).expiresAt)))]),Y("click",on,A),S(ot,Pt)},pi=ot=>{var Pt=Af(),Ht=H(Pt);{var Dt=je=>{var zn=Nf();S(je,zn)};Q(Ht,je=>{a(u)&&a(n)&&je(Dt)})}var Xe=$(Ht,2),on=x(Xe);{var He=je=>{Ur(je,{size:15,class:"animate-spin"})},_n=je=>{za(je,{size:15})};Q(on,je=>{a(d)?je(He):je(_n,-1)})}var yn=$(on);le(()=>{Xe.disabled=a(d),pe(yn,` ${a(u)?"重新生成配对码":"生成新设备配对码"}`)}),Y("click",Xe,E),S(ot,Pt)};Q(sn,ot=>{a(u)&&!a(n)?ot(hi):ot(pi,-1)})}var mi=$(sn,2);{var Fr=ot=>{var Pt=Tf(),Ht=x(Pt),Dt=x(Ht);le(()=>pe(Dt,a(h))),S(ot,Pt)};Q(mi,ot=>{a(h)&&ot(Fr)})}S(Je,an)};Q(Re,Je=>{!o()&&c()&&Je(Et)})}var kt=$(Re,2),st=x(kt);au(st,{size:16});var Qe=$(st);le(()=>{Ye!==(Ye=i())&&(Ae.value=(Ae.__value=i())??"",ii(Ae,i())),kc(R,s()),pe(De,` ${o()?"演示模式":"Cloudflare 已连接"}`),pe(at,o()?"所有内容仅保存在当前页面内存，刷新后消失。":l()),pe(Qe,` ${o()?"退出演示模式":"断开这个设备"}`)}),Y("click",V,()=>b("close")),Y("click",ie,()=>b("close")),Y("change",Ae,_),Y("change",R,Je=>b("semanticchange",Je.currentTarget.checked)),Y("click",rn,()=>b("themechange","system")),Y("click",Ct,()=>b("themechange","notesflash")),Y("click",I,()=>b("themechange","notesflash-dark")),Y("click",kt,()=>b("disconnect")),S(N,F)};Q(k,N=>{r()&&N(T)})}S(e,K),te()}function Qa(e,t,n,r,i,s){return r?e==="down"?t>=n?0:t+1:t<=0?n:t-1:e==="up"?n:i&&s?1:0}function Br(e,t,n,r){return e&&t===null&&n===r}var Pf=z(" <!>",1),Df=z('<div class="alert mb-3 min-h-0 rounded-box border border-warning/20 bg-warning/8 py-2 text-xs"><!> <span>演示模式：内容只在当前页面内存中，刷新后会消失。</span></div>'),Of=z('<div class="alert alert-error mb-3 min-h-0 rounded-box py-2 text-sm" role="alert"><span> </span> <button class="btn btn-ghost btn-xs">关闭</button></div>'),Rf=z('<div class="mb-2"><!></div>'),Lf=z('<div class="flex items-center justify-center gap-2 py-20 text-sm text-base-content/45"><!> 正在读取云端笔记…</div>'),zf=z('<div class="flex flex-col items-center py-20 text-center text-base-content/42"><!> <p class="mt-3 text-sm">还没有笔记</p> <button class="btn btn-primary btn-sm mt-4">创建第一条</button></div>'),Uf=z("<!> 正在寻找语义相关内容…",1),Ff=z('<div class="flex items-center justify-center gap-2 py-14 text-sm text-base-content/40"><!></div>'),jf=z("<div><!></div>"),Vf=z('<section class="pb-16" aria-label="笔记流"></section>'),qf=z('<div class="toast toast-center toast-bottom z-[70] pb-[calc(1rem+var(--safe-bottom))]"><div class="alert min-h-0 border border-base-300 bg-neutral px-4 py-2 text-sm text-neutral-content shadow-lg"><span> </span></div></div>'),Bf=z('<main class="app-shell"><!> <div class="mb-3 mt-3 flex min-h-5 items-center justify-between px-1 text-[11px] text-base-content/42"><span><!></span> <span class="hidden items-center gap-1.5 sm:flex"><!> ⇧ Space 唤起 · Tab 复制并编辑</span></div> <!> <!> <!> <!></main> <!> <!>',1);function Hf(e,t){ee(t,!1);const n=O();let r=O($u()),i=O(a(r)?new ja(a(r)):null),s=O(!1),o=O([]),l=O([]),c=O([]),u=O([]),d=O([]),h=O(""),f=O(""),p=O(!1),g=O(0),b=O(!1),_=O(null),E=O(!1),A=O(!1),P=O(!1),K=O(yn("sort","updated_desc")),k=O(yn("semantic","true")==="true"),T=yn("theme","system"),N=O(""),F=O(""),V=O(),J,ge,ie=0,we=0,Te=0,Ne=[],fe=0,Ae=0,he=O(null),de=null;const qe=()=>{Xe(),ot()},Ye=()=>{document.visibilityState==="visible"&&ot()},Z=window.matchMedia("(prefers-color-scheme: dark)"),Fe=()=>{T==="system"&&Dt()};ua(()=>{Dt(),!a(i)&&Be()?St():a(i)&&R(),window.addEventListener("keydown",sn),window.addEventListener("focus",qe),document.addEventListener("visibilitychange",Ye),Z.addEventListener("change",Fe),Xe();const y=[];return"__TAURI_INTERNALS__"in window&&Lc(()=>import("./event-C_pQPlB4.js"),[]).then(async({listen:w})=>{y.push(await w("notesflash://focus-search",()=>Xe(!0)),await w("notesflash://shortcut-error",()=>{He("全局快捷键被其他应用占用；NotesFlash 仍可从 Dock 打开。")}))}).catch(()=>{}),()=>{window.removeEventListener("keydown",sn),window.removeEventListener("focus",qe),document.removeEventListener("visibilitychange",Ye),Z.removeEventListener("change",Fe),window.clearTimeout(J),window.clearTimeout(ge),y.forEach(w=>w())}});async function R(){if(!a(i))return;const y=++fe;m(E,!0),m(N,"");try{const w=await a(i).listNotes(a(K),C=>{y===fe&&m(o,Fr(C))});y===fe&&(m(o,Fr(w)),mi(a(o)),Ae=Date.now())}catch(w){y===fe&&_n(w,"无法从云端载入笔记。")}finally{y===fe&&m(E,!1)}}function ae(y){m(r,y),m(s,!1),m(i,new ja(y)),m(o,[]),Nu(y),R(),Xe(!0)}function Be(){try{const y=new URLSearchParams(window.location.search);return y.get("demo")==="1"||y.get("demo")==="true"?!0:window.location.hash==="#demo"}catch{return!1}}function St(){m(r,null),m(s,!0),m(i,new Iu),R(),Xe(!0)}async function rn(){var y;if(a(he)&&!await a(he).flush()){He("仍有内容未保存，请先解决保存错误。");return}try{await((y=a(i))==null?void 0:y.logout())}catch{}Au(),fe+=1,m(r,null),m(i,null),m(s,!1),m(o,[]),m(h,""),m(f,""),m(_,null),m(P,!1)}function Ct(y){if(m(h,y),m(b,!1),!a(_)){I(y);return}if(de)return;m(p,!0);const w=(async()=>{const C=a(he);if(C&&!await C.flush()){m(h,a(f)),He("保存失败，已保留当前编辑内容，搜索没有切换。");return}m(_,null),I(a(h))})().finally(()=>{de===w&&(de=null),m(p,!1)});de=w}function I(y,w=!1){m(f,y),m(g,0),m(N,""),window.clearTimeout(J),window.clearTimeout(ge),m(A,!1);const C=++ie,Ve=y.trim();w||(m(l,[]),m(c,[])),we=0,Te=0,Ne=[],!(!Ve||!a(i))&&(J=window.setTimeout(()=>void D(Ve,C),120),a(k)&&Ve.length>=3?ge=window.setTimeout(()=>void B(Ve,C),360):m(c,[]))}async function D(y,w){if(a(i))try{const C=await a(i).lexicalSearch(y);w===ie&&m(l,C)}catch(C){w===ie&&_n(C,"关键词搜索失败。")}finally{w===ie&&(we=w,Te===w&&(m(c,Ne),Te=0,Ne=[]))}}async function B(y,w){if(a(i)){m(A,!0);try{const C=await a(i).semanticSearch(y);w===ie&&(we===w?m(c,C):(Te=w,Ne=C))}catch(C){w===ie&&(m(c,[]),Te=0,Ne=[],C instanceof Bt&&[402,429,503].includes(C.status)&&He("语义搜索暂时不可用，已保留关键词结果。"))}finally{w===ie&&m(A,!1)}}}async function se(){if(!a(i)||de)return;if(m(b,!1),a(he)&&!await a(he).flush()){He("当前笔记尚未保存，暂时不能创建另一条。");return}m(_,null);const y=da(a(h)),w=y.title||"新笔记";try{const C=await a(i).createNote({title:w,body:y.body});m(o,pi([C,...a(o).filter(Ve=>Ve.id!==C.id)])),Ct(""),m(_,C.id),window.setTimeout(()=>{var Ve;return(Ve=document.getElementById(`note-${C.id}`))==null?void 0:Ve.scrollIntoView({block:"nearest"})},0)}catch(C){_n(C,"无法创建笔记。")}}async function De(y,w){if(!a(i))throw new Error("尚未连接后端。");const C=await a(i).updateNote(y,w);return Re(C),C}async function Ie(y){a(i)&&(await a(i).deleteNote(y.id,y.version),m(o,a(o).filter(w=>w.id!==y.id)),m(l,a(l).filter(w=>w.note.id!==y.id)),m(c,a(c).filter(w=>w.note.id!==y.id)),m(_,null),He("笔记已删除"),Xe())}async function at(y){if(!a(i))throw new Error("尚未连接后端。");if(y.size>12*1024*1024)throw new Error("单张图片不能超过 12 MB。");return a(i).uploadImage(y)}function Re(y){m(o,a(o).map(w=>w.id===y.id?y:w)),m(l,a(l).map(w=>w.note.id===y.id?{...w,note:y}:w)),m(c,a(c).map(w=>w.note.id===y.id?{...w,note:y}:w))}function Et(y){const w=y.detail;if(ro(w))return;if(de){w.preventDefault();return}const C=!!a(f).trim();if(w.key==="ArrowDown"){w.preventDefault(),m(g,Qa("down",a(g),a(n),a(b),!!a(f).trim(),a(d).length>0)),m(b,!0),on(a(g));return}if(w.key==="ArrowUp"){w.preventDefault(),m(g,Qa("up",a(g),a(n),a(b),!!a(f).trim(),a(d).length>0)),m(b,!0),on(a(g));return}if(w.key==="Enter"){w.preventDefault(),C&&a(g)===0?se():kt(!1);return}if(w.key==="Tab"&&!(C&&a(g)===0)){w.preventDefault(),kt(!0);return}w.key==="Escape"&&(w.preventDefault(),a(h)?Ct(""):Qe())}async function kt(y){const w=Ln();w&&await st(w.note.id)&&(y&&await Ze(w),window.setTimeout(()=>{var C,Ve;(C=a(he))==null||C.focusBody(),(Ve=document.getElementById(`note-${w.note.id}`))==null||Ve.scrollIntoView({block:"nearest"})},0))}async function st(y){if(de)return!1;if(a(_)===y)return!0;m(b,!1);const w=a(_);return a(he)&&!await a(he).flush()?(He("当前笔记尚未保存，仍保留在编辑状态。"),!1):(w&&an(w),m(_,y),!0)}async function Qe(){if(a(he)&&!await a(he).flush()){He("保存失败，编辑内容仍保留。");return}Je()}function Je(){m(_,null),m(b,!1),a(f).trim()&&I(a(f),!0),Xe()}function an(y){if(!a(f).trim())return;const w=a(o).find(ln=>ln.id===y);if(!w)return;const C=Xt(a(f));Xt(`${w.title}
${w.body}`).includes(C)||m(l,a(l).filter(ln=>ln.note.id!==y)),w.embeddingStatus!=="ready"&&m(c,a(c).filter(ln=>ln.note.id!==y))}function Ln(){const y=a(g)-(a(f).trim()?1:0);return a(d)[y]}async function Ze(y){const w=io(`${y.note.title}
${y.note.body}`,a(f))||y.note.title;await oo(w)&&He("已复制命中内容")}function sn(y){(y.metaKey||y.ctrlKey)&&y.key.toLocaleLowerCase()==="n"&&(y.preventDefault(),se()),(y.metaKey||y.ctrlKey)&&y.key===","&&(y.preventDefault(),m(P,!0)),(y.metaKey||y.ctrlKey)&&y.key.toLocaleLowerCase()==="k"&&(y.preventDefault(),Xe(!0))}function hi(y){m(K,y),je("sort",y),R()}function pi(y){return[...y].sort((w,C)=>a(K)==="title_asc"?w.title.localeCompare(C.title,"zh-CN"):a(K)==="created_desc"?C.createdAt-w.createdAt:C.updatedAt-w.updatedAt)}function mi(y){const w=new Map(y.map(C=>[C.id,C]));m(l,a(l).map(C=>({...C,note:w.get(C.note.id)??C.note}))),m(c,a(c).map(C=>({...C,note:w.get(C.note.id)??C.note})))}function Fr(y){if(!a(_)||y.some(C=>C.id===a(_)))return y;const w=a(o).find(C=>C.id===a(_));return w?[w,...y]:y}function ot(){!a(i)||a(E)||Date.now()-Ae<1200*60*1e3||R()}async function Pt(y){if(y===a(k))return;const w=a(k);if(m(k,y),a(_)&&a(he)&&!await a(he).flush()){m(k,w),He("保存失败，已保留当前编辑内容，语义搜索设置没有改变。");return}m(_,null),je("semantic",String(y)),y||(m(c,[]),m(A,!1),window.clearTimeout(ge)),a(f).trim()&&I(a(f),!0)}function Ht(y){T=y,je("theme",y),Dt()}function Dt(){document.documentElement.dataset.theme=T==="system"?Z.matches?"notesflash-dark":"notesflash":T}function Xe(y=!1){window.setTimeout(()=>{var w;(w=a(V))==null||w.focus()},20)}function on(y){window.setTimeout(()=>{var w;(w=document.getElementById(`search-option-${y}`))==null||w.scrollIntoView({block:"nearest",behavior:"smooth"})},0)}function He(y){m(F,y),window.setTimeout(()=>{a(F)===y&&m(F,"")},1800)}function _n(y,w){m(N,y instanceof Error?y.message:w),y instanceof Bt&&y.status===401&&He("连接已失效，请重新配对。")}function yn(y,w){try{return localStorage.getItem(`notesflash.preference.${y}`)??w}catch{return w}}function je(y,w){try{localStorage.setItem(`notesflash.preference.${y}`,w)}catch{}}ft(()=>(a(f),a(l),a(c),a(o)),()=>{m(u,a(f).trim()?ku(a(l),a(c)):a(o).map(y=>({note:y,matchType:"lexical",snippet:"",score:0})))}),ft(()=>a(u),()=>{m(d,a(u))}),ft(()=>(a(d),a(f)),()=>{m(n,Math.max(0,a(d).length-1+(a(f).trim()?1:0)))}),ft(()=>(a(g),a(n)),()=>{a(g)>a(n)&&m(g,a(n))}),gn(),nn();var zn=ue(),Ot=H(zn);{var bn=y=>{Bu(y,{$$events:{connected:w=>ae(w.detail),demo:St}})},dr=y=>{var w=Bf(),C=H(w),Ve=x(C);ai(Sf(Ve,{get value(){return a(h)},get semanticSearching(){return a(A)},get semanticEnabled(){return a(k)},get selectedIndex(){return a(g)},$$events:{input:U=>Ct(U.detail),keyaction:Et,settings:()=>m(P,!0)},$$legacy:!0}),U=>m(V,U),()=>a(V));var ln=$(Ve,2),ha=x(ln),lo=x(ha);{var co=U=>{var X=En("正在保存当前笔记并切换搜索…");S(U,X)},uo=U=>{var X=Pf(),re=H(X),Me=$(re);{var vt=et=>{var cn=En("· 正在补充语义结果");S(et,cn)};Q(Me,et=>{a(A)&&et(vt)})}le(()=>pe(re,`${a(d),M(()=>a(d).length)??""} 条匹配 `)),S(U,X)},fo=qn(()=>(a(f),M(()=>a(f).trim()))),vo=U=>{var X=En();le(()=>pe(X,`${a(o),M(()=>a(o).length)??""} 条笔记 · 全文平铺`)),S(U,X)};Q(lo,U=>{a(p)?U(co):a(fo)?U(uo,1):U(vo,-1)})}var ho=$(ha,2),po=x(ho);no(po,{size:12});var pa=$(ln,2);{var mo=U=>{var X=Df(),re=x(X);Bc(re,{size:15}),S(U,X)};Q(pa,U=>{a(s)&&U(mo)})}var ma=$(pa,2);{var go=U=>{var X=Of(),re=x(X),Me=x(re),vt=$(re,2);le(()=>pe(Me,a(N))),Y("click",vt,()=>m(N,"")),S(U,X)};Q(ma,U=>{a(N)&&U(go)})}var ga=$(ma,2);{var _o=U=>{var X=Rf(),re=x(X);{let Me=Ut(()=>(_e(Br),a(b),a(_),a(g),M(()=>Br(a(b),a(_),a(g),0))));hf(re,{get query(){return a(f)},get selected(){return a(Me)},$$events:{click:se}})}S(U,X)},yo=qn(()=>(a(f),M(()=>a(f).trim())));Q(ga,U=>{a(yo)&&U(_o)})}var bo=$(ga,2);{var wo=U=>{var X=Lf(),re=x(X);Ur(re,{size:18,class:"animate-spin"}),S(U,X)},xo=U=>{var X=zf(),re=x(X);vu(re,{size:30,strokeWidth:1.5});var Me=$(re,4);Y("click",Me,se),S(U,X)},So=qn(()=>(a(d),a(f),M(()=>a(d).length===0&&!a(f).trim()))),Eo=U=>{var X=Ff(),re=x(X);{var Me=et=>{var cn=Uf(),gi=H(cn);fa(gi,{size:16,class:"text-primary"}),S(et,cn)},vt=et=>{var cn=En("没有现有匹配，可以直接创建。");S(et,cn)};Q(re,et=>{a(A)?et(Me):et(vt,-1)})}S(U,X)},ko=qn(()=>(a(d),a(f),M(()=>a(d).length===0&&a(f).trim()))),$o=U=>{var X=Vf();fr(X,7,()=>a(d),re=>re.note.id,(re,Me,vt)=>{var et=jf(),cn=x(et);{var gi=Un=>{ai(df(Un,{get note(){return a(Me),M(()=>a(Me).note)},saveNote:De,deleteNote:Ie,uploadImage:at,close:Je,$$legacy:!0}),_i=>m(he,_i),()=>a(he))},To=Un=>{{let _i=Ut(()=>(_e(a(vt)),a(f),M(()=>a(vt)+(a(f).trim()?1:0)))),Io=Ut(()=>(_e(Br),a(b),a(_),a(g),_e(a(vt)),a(f),M(()=>Br(a(b),a(_),a(g),a(vt)+(a(f).trim()?1:0)))));rf(Un,{get hit(){return a(Me)},get query(){return a(f)},get optionIndex(){return a(_i)},get selected(){return a(Io)},$$events:{edit:()=>void st(a(Me).note.id)}})}};Q(cn,Un=>{a(_),a(Me),M(()=>a(_)===a(Me).note.id)?Un(gi):Un(To,-1)})}le(()=>Se(et,"id",(a(Me),M(()=>`note-${a(Me).note.id}`)))),S(re,et)}),S(U,X)};Q(bo,U=>{a(E),a(d),M(()=>a(E)&&a(d).length===0)?U(wo):a(So)?U(xo,1):a(ko)?U(Eo,2):U($o,-1)})}var _a=$(C,2);{let U=Ut(()=>(a(r),M(()=>{var re;return((re=a(r))==null?void 0:re.endpoint)??""}))),X=Ut(()=>!a(s)&&a(i)?()=>a(i).createPairingCode():void 0);Cf(_a,{get open(){return a(P)},get sortMode(){return a(K)},get semanticEnabled(){return a(k)},get demoMode(){return a(s)},get endpoint(){return a(U)},get createPairingCode(){return a(X)},$$events:{close:()=>m(P,!1),sortchange:re=>hi(re.detail),semanticchange:re=>void Pt(re.detail),themechange:re=>Ht(re.detail),disconnect:()=>void rn()}})}var No=$(_a,2);{var Ao=U=>{var X=qf(),re=x(X),Me=x(re),vt=x(Me);le(()=>pe(vt,a(F))),S(U,X)};Q(No,U=>{a(F)&&U(Ao)})}S(y,w)};Q(Ot,y=>{a(i)?y(dr,-1):y(bn)})}S(e,zn),te()}cc(Hf,{target:document.getElementById("app")});
