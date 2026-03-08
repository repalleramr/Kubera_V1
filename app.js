
let bank=30000
let start=30000
let chakra=1
let coin=100
let history=[]
let pendingY=null
let pendingK=null

function update(){
document.getElementById('bank').innerText=bank
document.getElementById('chakra').innerText=chakra
}

function toast(msg){alert(msg)}

function buildPads(){

const padY=document.getElementById('padY')
const padK=document.getElementById('padK')

for(let i=1;i<=9;i++){
let b=document.createElement('button')
b.innerText=i
b.onclick=()=>press('Y',i)
padY.appendChild(b)
}

for(let i=1;i<=9;i++){
let b=document.createElement('button')
b.innerText=i
b.onclick=()=>press('K',i)
padK.appendChild(b)
}

}

function press(side,val){

if(side==='Y') pendingY=val
if(side==='K') pendingK=val

if(pendingY!==null && pendingK!==null){
process(pendingY,pendingK)
pendingY=null
pendingK=null
}

}

function process(y,k){

history.push({bank,chakra})

let exposure=coin
bank-=exposure

if(y===k){
bank+=coin*9
toast("TREASURY TRIUMPH")
}

chakra++
risk()
update()

}

function risk(){

let diff=start-bank
let fill=document.getElementById('riskfill')
let text=document.getElementById('risktext')

let pct=Math.min(100,diff/20000*100)
fill.style.width=pct+"%"

if(pct<30){fill.style.background="#00ff7f";text.innerText="LOW RISK"}
else if(pct<60){fill.style.background="orange";text.innerText="MEDIUM RISK"}
else{fill.style.background="red";text.innerText="HIGH RISK"}

}

document.getElementById('undo').onclick=function(){
let last=history.pop()
if(!last) return
bank=last.bank
chakra=last.chakra
update()
}

document.getElementById('clear').onclick=function(){
bank=start
chakra=1
history=[]
update()
}

document.getElementById('new').onclick=function(){
toast("PRAYOGA READY")
}

document.getElementById('coin').onchange=function(){
coin=parseInt(this.value)
}

buildPads()
update()
