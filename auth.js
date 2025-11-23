async function post(url,data){
  return (await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})).json();
}
const rf=document.getElementById("registerForm");
if(rf){rf.addEventListener("submit",async e=>{
e.preventDefault();
let res=await post("/api/register",{name: name.value, email: email.value, password: password.value});
msg.textContent=res.success?"Registered":"Error: "+res.error;
});}

const lf=document.getElementById("loginForm");
if(lf){lf.addEventListener("submit",async e=>{
e.preventDefault();
let res=await post("/api/login",{email: email.value, password: password.value});
msg.textContent=res.success?"Logged in!":"Error: "+res.error;
if(res.success) setTimeout(()=>location="/chat.html",300);
});}
