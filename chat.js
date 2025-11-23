(async()=>{
 let me=await fetch('/api/me');
 if(!me.ok){status.textContent="Login first.";return;}
 let user=await me.json();
 status.textContent="Welcome "+user.user.name;
 chatBox.style.display="block";

 let msgs=await (await fetch('/api/messages')).json();
 msgs.messages.forEach(m=>{
 let el=document.createElement("div"); el.textContent=m.username+": "+m.message; messages.appendChild(el);
 });

 let socket=io();
 socket.on("message",m=>{
 let el=document.createElement("div"); el.textContent=m.username+": "+m.message; messages.appendChild(el);
 });

 msgForm.addEventListener("submit",e=>{
 e.preventDefault();
 socket.emit("sendMessage", msgInp.value);
 msgInp.value="";
 });

 logoutBtn.onclick=async()=>{await fetch("/api/logout",{method:"POST"}); location="/";};
})();
