
let bankroll=30000;
let chakra=1;

document.querySelectorAll('.nav-btn').forEach(btn=>{
btn.onclick=()=>{
document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
document.getElementById(btn.dataset.target).classList.add('active');
btn.classList.add('active');
}
});

if(navigator.vibrate){document.querySelectorAll('.num-btn').forEach(b=>{
b.addEventListener('click',()=>navigator.vibrate(10));
});}

