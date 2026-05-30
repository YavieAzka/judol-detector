var e=n(`slot
slot online
slot gacor
slot77
slot88
judi
judi online
judi slot
judol
judol online
togel
togel online
toto
toto online
casino
casino online
poker
poker online
bandar
bandar togel
bandarqq
agen judi
agen sbobet
sbobet
sbobet online
roulette
roulette online
baccarat
baccarat online
blackjack
tembak ikan
tembak ikan online
cockfight
sabung ayam
sabung ayam online
taruhan
taruhan online
bet
betting
min depo
depo 10rb
depo 25rb
deposit pulsa
slot deposit pulsa
rtp
rtp live
rtp slot
rtp gacor
maxwin
maxwin slot
anti rungkad
spin
free spin
bonus
bonus new member
bonus deposit
jackpot
jackpot progresif
gacor
gacor maxwin
pg soft
pragmatic
pragmatic play
habanero
spadegaming
joker
joker123
joker gaming
microgaming
playtech
live22
lion slot
mega888
918kiss
xo slot
cq9
ae gaming
simpleplay
bandar bola
bolatangkas
bola online
mix parlay
over under
handicap
1x2
bahasa
taruhan bola
scatter
hoki`);chrome.runtime.onInstalled.addListener(()=>{t()}),chrome.runtime.onStartup.addListener(()=>{t()});async function t(){try{await chrome.storage.local.set({activeDictionary:e}),console.log(`Dictionary loaded into memory:`,e.length,`words`)}catch(e){console.error(`Failed to load keywords.txt:`,e)}}function n(e){return e.split(/\r?\n/).map(e=>e.trim()).filter(e=>e.length>0)}var r=null;async function i(){if(!await chrome.offscreen.hasDocument()){if(r){await r;return}r=chrome.offscreen.createDocument({url:`offscreen.html`,reasons:[`WORKERS`,`DOM_PARSER`],justification:`Run Tesseract OCR worker securely in extension context to bypass strict webpage CSPs`});try{await r}catch(e){console.error(`Failed to create offscreen document:`,e)}finally{r=null}}}async function a(e){return await i(),new Promise(t=>{let n,r=i=>{i.action===`OCR_RESULT`&&i.imageSrc===e&&(chrome.runtime.onMessage.removeListener(r),clearTimeout(n),t(i.text))};n=setTimeout(()=>{chrome.runtime.onMessage.removeListener(r),console.warn(`OCR request timed out for image:`,e),t(``)},3e4),chrome.runtime.onMessage.addListener(r),chrome.runtime.sendMessage({target:`offscreen`,action:`RUN_OCR`,imageSrc:e}).catch(e=>{console.error(`Failed to send message to offscreen:`,e),chrome.runtime.onMessage.removeListener(r),clearTimeout(n),t(``)})})}chrome.runtime.onMessage.addListener((e,t,n)=>{if(e.action===`PERFORM_OCR`)return a(e.imageSrc).then(e=>{n({text:e})}),!0});