// ============================================================
//  NetSim engine — единый движок + сценарии уровней
// ============================================================

// -------------------- УТИЛИТЫ --------------------
function ipToInt(ip){ return ip.split('.').reduce((a,o)=>(a<<8)+parseInt(o,10),0)>>>0; }
function sameSubnet(a,b,mask){ const m=(0xffffffff<<(32-mask))>>>0; return (ipToInt(a)&m)===(ipToInt(b)&m); }
function isValidIp(ip){ return /^(\d{1,3}\.){3}\d{1,3}$/.test((ip||'').trim()) && ip.split('.').every(o=>+o>=0&&+o<=255); }
function isValidMac(mac){ return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test((mac||'').trim()); }
const BCAST = "ff:ff:ff:ff:ff:ff";

// -------------------- ГЛОБАЛЬНОЕ СОСТОЯНИЕ --------------------
let clipboard = null;
let LEVEL = null;        // текущий объект уровня
let STATE = {};          // изменяемое состояние текущего уровня

// -------------------- КОПИРОВАНИЕ / ВСТАВКА --------------------
document.body.addEventListener('click', (e) => {
  const cp = e.target.closest('.copy-btn');
  if (cp) {
    clipboard = cp.dataset.copy;
    document.querySelectorAll('.copy-btn').forEach(b => { b.classList.remove('copied'); b.textContent = 'копировать'; });
    cp.classList.add('copied'); cp.textContent = '✓ скопировано';
    return;
  }
  const pb = e.target.closest('.paste-btn');
  if (pb) {
    if (clipboard == null) { note('⚠ Сначала скопируй значение из книжки (кнопка «копировать»).'); return; }
    const target = document.getElementById(pb.dataset.paste);
    if (target) target.value = clipboard;
    return;
  }
});

// -------------------- ХЕЛПЕРЫ РЕНДЕРА --------------------
function el(id){ return document.getElementById(id); }
function log(html){ const l = el('log'); if (l) l.innerHTML = html; }
function note(html){ const n = el('note'); if (n) n.innerHTML = html; }
function fail(msg){
  log(`<span class="emoji">😞</span> <span class="log-err">Что-то пошло не так.</span>\n<span class="log-step">${msg}</span>`);
}

// строит книжку-таблицу из массива строк [{cells:[..], copy:'значение' | null}]
function book(title, header, rows, extraStyle=''){
  let html = `<div class="panel book" style="${extraStyle}"><h2>${title}</h2><table><tr>`;
  header.forEach(h => html += `<th>${h}</th>`);
  html += `</tr>`;
  rows.forEach(r => {
    html += `<tr>`;
    r.cells.forEach((c,i) => {
      if (r.copy && i === r.cells.length - 1) {
        html += `<td><div class="copyable"><span>${c}</span>`
          + `<button class="copy-btn" data-copy="${r.copy}">копировать</button></div></td>`;
      } else {
        html += `<td>${c}</td>`;
      }
    });
    html += `</tr>`;
  });
  html += `</table></div>`;
  return html;
}

// -------------------- ПЕРЕКЛЮЧАТЕЛЬ УРОВНЕЙ --------------------
document.querySelectorAll('.lvl-btn').forEach(btn => {
  btn.addEventListener('click', () => loadLevel(btn.dataset.level));
});

function loadLevel(id){
  document.querySelectorAll('.lvl-btn').forEach(b => b.classList.toggle('active', b.dataset.level === id));
  LEVEL = LEVELS[id];
  STATE = {};
  el('roleSub').innerHTML = LEVEL.roleSub;
  if (LEVEL.render) {
    LEVEL.render();
  } else {
    el('leftCol').innerHTML = LEVEL.left();
    el('rightCol').innerHTML = LEVEL.right();
    if (LEVEL.init) LEVEL.init();
  }
}

// ============================================================
//  СЦЕНАРИИ УРОВНЕЙ
// ============================================================
const LEVELS = {};

// ------------------------------------------------------------
//  УРОВЕНЬ 1 — Хост: DNS-резолв + сборка + отправка
// ------------------------------------------------------------
LEVELS["1"] = (function(){
  const S = {
    me: { name:"PC1", ip:"192.168.1.10", mask:24, mac:"aa:aa:aa:00:00:01", gateway:"192.168.1.1", dns:"192.168.1.1" },
    gatewayMac: "bb:bb:bb:00:00:01",
    neighborMacs: ["bb:bb:bb:00:00:05","bb:bb:bb:00:00:20","bb:bb:bb:00:00:07"],
    dnsRecords: { "www.example.com": "93.184.216.34" },
    siteName: "www.example.com",
    serverMac: "cc:cc:cc:00:00:99",
  };

  function left(){
    return `
      <div class="panel">
        <h2>📇 Кто я (PC1)</h2>
        <div class="book"><table>
          <tr><td>IP-адрес</td><td>${S.me.ip} /${S.me.mask}</td></tr>
          <tr><td>MAC-адрес</td><td>${S.me.mac}</td></tr>
          <tr><td>Шлюз</td><td>${S.me.gateway}</td></tr>
          <tr><td>DNS-сервер</td><td>${S.me.dns}</td></tr>
        </table></div>
        <h2 style="margin-top:12px;">🔌 Мои порты</h2>
        <div class="ports"><div class="port"><b>eth0</b> → сеть</div></div>
      </div>
      <div class="panel book"><h2>📖 DNS-кэш</h2>
        <table id="dnsBook"><tr><th>Имя</th><th>IP</th></tr>
          <tr><td colspan="2" style="color:#55607a;">— пусто —</td></tr></table>
      </div>
      ${book("📖 ARP-таблица", ["IP","MAC"], [
        {cells:["192.168.1.5","bb:bb:bb:00:00:05"], copy:"bb:bb:bb:00:00:05"},
        {cells:["192.168.1.1","bb:bb:bb:00:00:01"], copy:"bb:bb:bb:00:00:01"},
        {cells:["192.168.1.20","bb:bb:bb:00:00:20"], copy:"bb:bb:bb:00:00:20"},
        {cells:["192.168.1.7","bb:bb:bb:00:00:07"], copy:"bb:bb:bb:00:00:07"},
      ])}
      <div class="panel book" style="border-color:#5a4632; background:#211b14;">
        <h2 style="color:#d8a86a;">🎩 Дополнительная информация</h2>
        <table><tr><th>IP (сервер)</th><th>MAC</th></tr>
          <tr><td>93.184.216.34</td>
            <td><div class="copyable"><span>cc:cc:cc:00:00:99</span>
              <button class="copy-btn" data-copy="cc:cc:cc:00:00:99">копировать</button></div></td></tr>
        </table>
      </div>`;
  }

  function right(){
    return `
      <div class="panel">
        <h2>🎯 Задача</h2>
        <div class="task">Браузер хочет открыть <b>www.example.com</b>. Отправь HTTP-запрос.</div>
        <button class="btn btn-hint" id="hintBtn">💡 Подсказка</button>
        <div class="note" id="hintText"></div>
      </div>
      <div class="panel">
        <h2>🌐 DNS-резолв</h2>
        <button class="btn btn-dns" id="dnsBtn">🔍 DNS RESOLVE: www.example.com</button>
        <div class="note" id="note"></div>
      </div>
      <div class="panel">
        <h2>✉️ Сборка пакета</h2>
        <div class="envelope">
          <div class="env-label">Ethernet-кадр (L2)</div>
          <div class="field"><label>src MAC</label><div class="fixed">${S.me.mac} (мой)</div></div>
          <div class="field"><label>dst MAC</label>
            <input id="dstMac" placeholder="кому передать прямо сейчас?">
            <button class="paste-btn" data-paste="dstMac">вставить</button></div>
          <div class="envelope env-ip">
            <div class="env-label">IP-пакет (L3)</div>
            <div class="field"><label>src IP</label><div class="fixed">${S.me.ip} (мой)</div></div>
            <div class="field"><label>dst IP</label>
              <input id="dstIp" placeholder="конечный адрес сайта">
              <button class="paste-btn" data-paste="dstIp">вставить</button></div>
            <div class="envelope env-app">
              <div class="env-label">Данные (L7)</div>
              <div class="field"><label>Payload</label><div class="fixed">GET / HTTP/1.1 — www.example.com</div></div>
            </div>
          </div>
        </div>
        <button class="btn btn-start" id="startBtn">▶ START — отправить в порт eth0</button>
      </div>
      <div class="panel"><h2>📡 Что произошло</h2>
        <div id="log"><span class="log-info">Собери пакет и нажми START…</span></div></div>`;
  }

  function init(){
    STATE.resolvedIp = null;
    el('dnsBtn').addEventListener('click', () => {
      const ip = S.dnsRecords[S.siteName];
      STATE.resolvedIp = ip;
      note(`<span class="log-info">→ Запрос "${S.siteName}?" отправлен на DNS-сервер ${S.me.dns}…</span>`
        + `<br><span class="log-ok">← Ответ: ${S.siteName} = ${ip}. Записано в DNS-кэш.</span>`);
      el('dnsBook').innerHTML = `<tr><th>Имя</th><th>IP</th></tr>
        <tr><td>${S.siteName}</td>
          <td><div class="copyable"><span>${ip}</span>
            <button class="copy-btn" data-copy="${ip}">копировать</button></div></td></tr>`;
      el('dnsBtn').disabled = true;
    });

    el('hintBtn').addEventListener('click', () => {
      const t = el('hintText');
      if (!STATE.resolvedIp) t.innerHTML = '💡 Ты знаешь только ИМЯ сайта, не IP. Сначала сделай <b>DNS RESOLVE</b>.';
      else t.innerHTML = '💡 <b>dst IP</b> — конечный адрес сайта (из DNS-кэша).<br>'
        + '💡 Сервер в <b>другой</b> сети → кадр отдаём <b>шлюзу</b>. <b>dst MAC</b> из ARP-таблицы — MAC шлюза, НЕ сервера!';
    });

    el('startBtn').addEventListener('click', check);
  }

  function check(){
    const dstMac = (el('dstMac').value||'').trim().toLowerCase();
    const dstIp  = (el('dstIp').value||'').trim();
    const me = S.me;

    if (!dstIp) return fail('Не заполнен <b>dst IP</b>. Куда в итоге должен прийти пакет?');
    if (!isValidIp(dstIp)) return fail('<b>dst IP</b> некорректен. Ожидается вид 1.2.3.4.');
    if (!STATE.resolvedIp) return fail('Ты вписал IP, но DNS ещё не спрашивал. Сделай <b>DNS RESOLVE</b>.');
    if (dstIp !== STATE.resolvedIp) return fail(`В <b>dst IP</b> стоит ${dstIp}, но DNS вернул ${STATE.resolvedIp}. Пакет уйдёт не туда.`);

    if (!dstMac) return fail('Не заполнен <b>dst MAC</b>. Кому физически передать кадр прямо сейчас?');
    if (!isValidMac(dstMac)) return fail('<b>dst MAC</b> некорректен. Ожидается вид aa:bb:cc:dd:ee:ff.');
    if (dstMac === me.mac) return fail('В <b>dst MAC</b> твой собственный MAC. Кадр не адресуется самому себе.');
    if (dstMac === S.serverMac) return fail(
      'В <b>dst MAC</b> ты поставил MAC самого сервера.<br>'
      + 'Сервер в <b>другой</b> сети — его MAC недоступен в твоём сегменте. Кадр не дойдёт.<br>'
      + '<b>Правило:</b> адресат в другой сети → кадр всегда отдаётся <b>шлюзу</b>.');

    const inMy = sameSubnet(dstIp, me.ip, me.mask);
    if (inMy) return fail('Адресат оказался в твоей сети — тогда dst MAC был бы MAC самого хоста. Но здесь сервер в другой сети.');

    if (dstMac === S.gatewayMac) return success(dstIp, dstMac);
    if (S.neighborMacs.includes(dstMac)) return fail(
      'Ты взял MAC <b>соседнего хоста</b> из своей сети, но это не шлюз.<br>'
      + 'Он не маршрутизирует пакеты в другую сеть — отбросит кадр.<br>'
      + '<b>Правило:</b> в другую сеть → dst MAC = MAC <b>шлюза (192.168.1.1)</b>.');
    return fail('Адресат в другой сети, но dst MAC неизвестный. Возьми из ARP-таблицы MAC шлюза (192.168.1.1).');
  }

  function success(dstIp, dstMac){
    log(`<span class="emoji">🎉</span> <span class="log-ok">Пакет собран верно и отправлен!</span>\n\n`
      + `<span class="log-step">1. Кадр ушёл в порт <b>eth0</b>.</span>\n`
      + `<span class="log-step">2. Свитч увидел dst MAC <b>${dstMac}</b> → шлюз, форвард на роутер.</span>\n`
      + `<span class="log-step">3. Роутер снял Ethernet, увидел dst IP <b>${dstIp}</b>, нашёл маршрут наружу.</span>\n`
      + `<span class="log-step">4. Пакет ушёл к www.example.com. HTTP-запрос доставлен ✅</span>\n\n`
      + `<span class="log-info">Главное: <b>dst IP</b> = конечный сервер (не меняется), <b>dst MAC</b> = шлюз (следующий хоп).</span>`);
  }

  return { roleSub:'Роль: <b>хост PC1</b>. Собери и отправь HTTP-запрос.', left, right, init };
})();

// ------------------------------------------------------------
//  УРОВЕНЬ 2a — Хост: нет MAC шлюза → ARP-запрос
//  Связка: адресат в другой сети → default route 0.0.0.0/0 → шлюз → ARP
// ------------------------------------------------------------
LEVELS["2a"] = (function(){
  const S = {
    me: { name:"PC1", ip:"192.168.1.10", mask:24, mac:"aa:aa:aa:00:00:01", gateway:"192.168.1.1" },
    gatewayMac: "bb:bb:bb:00:00:01",     // узнаётся через ARP
    targetIp: "8.8.8.8",                 // пингуем адрес в другой сети
    // маршруты: только connected + default
    routes: [
      { net:"192.168.1.0/24", via:"— (connected)", iface:"eth0" },
      { net:"0.0.0.0/0",      via:"192.168.1.1",   iface:"eth0" },
    ],
  };

  function left(){
    return `
      <div class="panel">
        <h2>📇 Кто я (PC1)</h2>
        <div class="book"><table>
          <tr><td>IP-адрес</td><td>${S.me.ip} /${S.me.mask}</td></tr>
          <tr><td>MAC-адрес</td><td>${S.me.mac}</td></tr>
        </table></div>
        <h2 style="margin-top:12px;">🔌 Мои порты</h2>
        <div class="ports"><div class="port"><b>eth0</b> → сеть</div></div>
      </div>
      ${book("📖 Таблица маршрутизации", ["Сеть","Next-hop (via)","Порт"],
        S.routes.map(r => ({cells:[r.net, r.via, r.iface], copy: r.via.startsWith("192")? r.via : null})))}
      <div class="panel book" id="arpPanel"><h2>📖 ARP-таблица</h2>
        <table id="arpBook"><tr><th>IP</th><th>MAC</th></tr>
          <tr><td colspan="2" style="color:#55607a;">— пусто (MAC шлюза неизвестен) —</td></tr></table>
      </div>`;
  }

  function right(){
    return `
      <div class="panel">
        <h2>🎯 Задача</h2>
        <div class="task">Нужно отправить ping на <b>${S.targetIp}</b> (адрес в другой сети).
          <br><span style="color:#7d8aa0;">Собери кадр. Но сначала пойми, кому его отдавать физически.</span></div>
        <button class="btn btn-hint" id="hintBtn">💡 Подсказка</button>
        <div class="note" id="hintText"></div>
      </div>

      <div class="panel">
        <h2>📡 Шаг 1: узнать MAC шлюза (ARP)</h2>
        <div style="font-size:12px;color:#9fb4d8;margin-bottom:8px;">
          В ARP-таблице пусто. Собери <b>ARP-запрос</b> broadcast'ом, чтобы узнать MAC того, чей IP тебе нужен.</div>
        <div class="envelope env-arp">
          <div class="env-label">ARP-request (broadcast)</div>
          <div class="field"><label>src MAC</label><div class="fixed">${S.me.mac} (мой)</div></div>
          <div class="field"><label>dst MAC</label>
            <input id="arpDstMac" placeholder="broadcast?">
            <button class="paste-btn" data-paste="arpDstMac">вставить</button></div>
          <div class="field"><label>Ищу IP</label>
            <input id="arpWho" placeholder="чей MAC тебе нужен?">
            <button class="paste-btn" data-paste="arpWho">вставить</button></div>
        </div>
        <div style="font-size:11px;color:#7d8aa0;margin-top:6px;">Подсказка: broadcast-адрес = <b>ff:ff:ff:ff:ff:ff</b> (можешь вписать вручную).</div>
        <button class="btn btn-dns" id="arpBtn" style="margin-top:10px;">📨 Отправить ARP-запрос</button>
        <div class="note" id="note"></div>
      </div>

      <div class="panel" id="pingPanel">
        <h2>✉️ Шаг 2: собрать и отправить ping</h2>
        <div class="envelope">
          <div class="env-label">Ethernet-кадр (L2)</div>
          <div class="field"><label>src MAC</label><div class="fixed">${S.me.mac} (мой)</div></div>
          <div class="field"><label>dst MAC</label>
            <input id="dstMac" placeholder="сначала выполни ARP">
            <button class="paste-btn" data-paste="dstMac">вставить</button></div>
          <div class="envelope env-ip">
            <div class="env-label">IP-пакет (L3)</div>
            <div class="field"><label>src IP</label><div class="fixed">${S.me.ip} (мой)</div></div>
            <div class="field"><label>dst IP</label>
              <input id="dstIp" placeholder="кого пингуем?">
              <button class="paste-btn" data-paste="dstIp">вставить</button></div>
            <div class="envelope env-app">
              <div class="env-label">Данные (L7)</div>
              <div class="field"><label>Payload</label><div class="fixed">ICMP Echo Request</div></div>
            </div>
          </div>
        </div>
        <button class="btn btn-start" id="startBtn">▶ START — отправить ping</button>
      </div>
      <div class="panel"><h2>📡 Что произошло</h2>
        <div id="log"><span class="log-info">Сначала ARP, потом собери ping и нажми START…</span></div></div>`;
  }

  function init(){
    STATE.arpDone = false;
    el('hintBtn').addEventListener('click', () => {
      const t = el('hintText');
      if (!STATE.arpDone) t.innerHTML = '💡 <b>' + S.targetIp + '</b> не в твоей сети 192.168.1.0/24. '
        + 'Смотри таблицу маршрутизации: подходит <b>0.0.0.0/0 → 192.168.1.1</b> (шлюз).<br>'
        + '💡 MAC шлюза неизвестен → ARP-запрос: dst MAC = <b>ff:ff:ff:ff:ff:ff</b>, «ищу IP» = <b>192.168.1.1</b>.';
      else t.innerHTML = '💡 Теперь MAC шлюза в ARP-таблице. <b>dst MAC</b> = MAC шлюза, <b>dst IP</b> = ' + S.targetIp + ' (конечный адрес).';
    });

    el('arpBtn').addEventListener('click', () => {
      const dm = (el('arpDstMac').value||'').trim().toLowerCase();
      const who = (el('arpWho').value||'').trim();
      if (dm !== BCAST) return note('<span class="log-err">⚠ ARP-запрос ищет неизвестный MAC — он должен идти <b>broadcast</b> (ff:ff:ff:ff:ff:ff), иначе кто на него ответит?</span>');
      if (who !== S.me.gateway) {
        if (who === S.targetIp)
          return note('<span class="log-err">⚠ Ты спрашиваешь MAC для 8.8.8.8 — но это адрес в <b>другой</b> сети, ARP работает только внутри своего сегмента. Тебе нужен MAC <b>шлюза 192.168.1.1</b>.</span>');
        return note('<span class="log-err">⚠ «Ищу IP» должен быть адресом шлюза <b>192.168.1.1</b> (next-hop из маршрута 0.0.0.0/0).</span>');
      }
      // успех ARP
      STATE.arpDone = true;
      note(`<span class="log-info">→ ARP-request разослан broadcast'ом: «У кого IP ${S.me.gateway}?»</span>`
        + `<br><span class="log-ok">← Шлюз ответил unicast'ом: ${S.me.gateway} = ${S.gatewayMac}. Записано в ARP-таблицу.</span>`);
      el('arpBook').innerHTML = `<tr><th>IP</th><th>MAC</th></tr>
        <tr><td>${S.me.gateway}</td>
          <td><div class="copyable"><span>${S.gatewayMac}</span>
            <button class="copy-btn" data-copy="${S.gatewayMac}">копировать</button></div></td></tr>`;
      el('arpBtn').disabled = true;
    });

    el('startBtn').addEventListener('click', () => {
      const dstMac = (el('dstMac').value||'').trim().toLowerCase();
      const dstIp  = (el('dstIp').value||'').trim();
      if (!STATE.arpDone) return fail('MAC шлюза ещё не известен. Сначала выполни <b>ARP-запрос</b> (Шаг 1).');
      if (!dstIp) return fail('Не заполнен <b>dst IP</b>.');
      if (!isValidIp(dstIp)) return fail('<b>dst IP</b> некорректен.');
      if (dstIp !== S.targetIp) return fail(`<b>dst IP</b> должен быть ${S.targetIp} — кого пингуем.`);
      if (!dstMac) return fail('Не заполнен <b>dst MAC</b>.');
      if (!isValidMac(dstMac)) return fail('<b>dst MAC</b> некорректен.');
      if (dstMac === BCAST) return fail('Boевой пакет не шлют broadcast\'ом. dst MAC = MAC шлюза (из ARP-таблицы).');
      if (dstMac !== S.gatewayMac) return fail('<b>dst MAC</b> должен быть MAC шлюза из ARP-таблицы (' + S.gatewayMac + ').');
      log(`<span class="emoji">🎉</span> <span class="log-ok">Ping отправлен!</span>\n\n`
        + `<span class="log-step">1. ARP разрешил ${S.me.gateway} → ${S.gatewayMac}.</span>\n`
        + `<span class="log-step">2. Кадр ушёл на шлюз ${S.me.gateway} (dst MAC = ${S.gatewayMac}).</span>\n`
        + `<span class="log-step">3. dst IP = ${S.targetIp} — конечный адрес, роутер повезёт пакет дальше.</span>\n\n`
        + `<span class="log-info">Связка усвоена: <b>другая сеть → default route 0.0.0.0/0 → шлюз → ARP шлюза → отправка</b>.</span>`);
    });
  }

  return { roleSub:'Роль: <b>хост PC1</b>. MAC шлюза неизвестен — добудь его через ARP.', left, right, init };
})();

// ------------------------------------------------------------
//  УРОВЕНЬ 2b — Нет маршрута → траблшутинг (я комп → инженер → я комп)
// ------------------------------------------------------------
LEVELS["2b"] = (function(){
  const S = {
    me: { name:"PC1", ip:"192.168.1.10", mask:24, mac:"aa:aa:aa:00:00:01" },
    hostA: "192.168.1.50",   // в моей сети → доступен
    hostB: "10.20.30.40",    // в другой сети → недоступен без маршрута
    gateway: "192.168.1.1",  // существует физически, но НЕ прописан
    aMac: "bb:bb:bb:00:00:50",
    gatewayMac: "bb:bb:bb:00:00:01",
  };

  function routesRows(){
    const rows = [{cells:["192.168.1.0/24","— (connected)","eth0"], copy:null}];
    if (STATE.gatewayAdded) rows.push({cells:["0.0.0.0/0", S.gateway, "eth0"], copy:S.gateway});
    return rows;
  }

  function left(){
    return `
      <div class="panel">
        <h2>📇 Кто я (PC1)</h2>
        <div class="book"><table>
          <tr><td>IP-адрес</td><td>${S.me.ip} /${S.me.mask}</td></tr>
          <tr><td>MAC-адрес</td><td>${S.me.mac}</td></tr>
        </table></div>
        <h2 style="margin-top:12px;">🔌 Мои порты</h2>
        <div class="ports"><div class="port"><b>eth0</b> → сеть</div></div>
      </div>
      <div id="routeBook"></div>
      ${book("📖 ARP-таблица", ["IP","MAC"], [
        {cells:[S.hostA, S.aMac], copy:S.aMac},
        {cells:[S.gateway, S.gatewayMac], copy:S.gatewayMac},
      ])}`;
  }

  function right(){
    return `
      <div class="panel">
        <h2>🎯 Задача</h2>
        <div class="task">Проверь связь с двумя хостами:<br>
          • <b>${S.hostA}</b> — коллега в твоей сети<br>
          • <b>${S.hostB}</b> — сервер в другой сети<br>
          <span style="color:#7d8aa0;">Пингуй по очереди и разберись, что происходит.</span></div>
        <button class="btn btn-hint" id="hintBtn">💡 Подсказка</button>
        <div class="note" id="hintText"></div>
      </div>

      <div class="panel">
        <h2>🖥️ Режим: Я — компьютер</h2>
        <div class="field"><label>ping IP</label>
          <input id="pingIp" placeholder="кого пингуем? напр. ${S.hostA}">
        </div>
        <button class="btn btn-start" id="pingBtn" style="margin-top:6px;">▶ PING</button>
      </div>

      <div class="panel" id="toolPanel">
        <h2>🔧 Режим: Я — инженер (траблшутинг)</h2>
        <div style="font-size:12px;color:#9fb4d8;margin-bottom:8px;">
          Если пакет некуда деть — значит не хватает маршрута. Пропиши шлюз по умолчанию.</div>
        <div class="field"><label>default gw</label>
          <input id="gwInput" placeholder="адрес шлюза, напр. ${S.gateway}">
        </div>
        <button class="btn btn-tool" id="addRouteBtn">➕ Добавить маршрут 0.0.0.0/0</button>
        <div class="note" id="note"></div>
      </div>

      <div class="panel"><h2>📡 Что произошло</h2>
        <div id="log"><span class="log-info">Начни с ping ${S.hostA}, потом попробуй ${S.hostB}…</span></div></div>`;
  }

  function renderRoutes(){
    el('routeBook').innerHTML = book("📖 Таблица маршрутизации", ["Сеть","Next-hop (via)","Порт"], routesRows());
  }

  function init(){
    STATE.gatewayAdded = false;
    renderRoutes();

    el('hintBtn').addEventListener('click', () => {
      el('hintText').innerHTML = '💡 ' + S.hostA + ' в сети 192.168.1.0/24 — доступен напрямую.<br>'
        + '💡 ' + S.hostB + ' в <b>другой</b> сети. Чтобы туда попасть, нужен маршрут. '
        + 'Проверь таблицу маршрутизации — есть ли <b>0.0.0.0/0</b>? Если нет — это и есть причина.';
    });

    el('pingBtn').addEventListener('click', () => {
      const ip = (el('pingIp').value||'').trim();
      if (!isValidIp(ip)) return fail('Введи корректный IP для ping.');

      if (sameSubnet(ip, S.me.ip, S.me.mask)) {
        // хост в моей сети — доступен всегда
        if (ip === S.hostA)
          return log(`<span class="emoji">🟢</span> <span class="log-ok">PING ${ip} — успех!</span>\n\n`
            + `<span class="log-step">${ip} в твоей сети 192.168.1.0/24 → connected-маршрут.</span>\n`
            + `<span class="log-step">ARP знает его MAC → кадр доставлен напрямую.</span>\n\n`
            + `<span class="log-info">Внутри своей сети маршрут не нужен — хост «под боком».</span>`);
        return log(`<span class="log-info">🟡 ${ip} в твоей сети, но такого хоста тут нет (нет ответа).</span>`);
      }

      // хост в другой сети — нужен маршрут
      if (!STATE.gatewayAdded)
        return log(`<span class="emoji">😞</span> <span class="log-err">PING ${ip} — недоступен.</span>\n\n`
          + `<span class="log-step">${ip} НЕ в твоей сети. Смотрю таблицу маршрутизации…</span>\n`
          + `<span class="log-err">✗ Нет маршрута до этой сети (нет 0.0.0.0/0). Пакет некуда деть → drop.</span>\n\n`
          + `<span class="log-info">💡 Переключись в режим <b>инженера</b> и пропиши шлюз по умолчанию.</span>`);

      return log(`<span class="emoji">🟢</span> <span class="log-ok">PING ${ip} — успех!</span>\n\n`
        + `<span class="log-step">Теперь есть маршрут 0.0.0.0/0 → ${S.gateway}.</span>\n`
        + `<span class="log-step">Пакет ушёл на шлюз, а тот повёз его в сторону сети ${ip}.</span>\n\n`
        + `<span class="log-info">🎉 Вот чего не хватало — <b>маршрута</b>! Это и есть суть траблшутинга.</span>`);
    });

    el('addRouteBtn').addEventListener('click', () => {
      const gw = (el('gwInput').value||'').trim();
      if (!isValidIp(gw)) return note('<span class="log-err">⚠ Введи корректный адрес шлюза.</span>');
      if (!sameSubnet(gw, S.me.ip, S.me.mask))
        return note('<span class="log-err">⚠ Шлюз должен быть в твоей сети (' + S.me.ip + '/' + S.me.mask + '), иначе ты до него не достучишься. Правильный — ' + S.gateway + '.</span>');
      if (gw !== S.gateway)
        return note('<span class="log-err">⚠ Такого шлюза в сети нет. Реальный шлюз — <b>' + S.gateway + '</b>.</span>');
      STATE.gatewayAdded = true;
      renderRoutes();
      note('<span class="log-ok">✓ Маршрут 0.0.0.0/0 → ' + S.gateway + ' добавлен! Вернись в режим «Я — компьютер» и повтори ping ' + S.hostB + '.</span>');
    });
  }

  return { roleSub:'Роль: <b>хост PC1</b> → при поломке становишься <b>инженером</b>.', left, right, init };
})();

// ------------------------------------------------------------
//  УРОВЕНЬ 3a — Свитч: known unicast → форвард в порт
// ------------------------------------------------------------
LEVELS["3a"] = (function(){
  const S = {
    name: "SW1",
    ports: ["Fa0/1","Fa0/2","Fa0/3","Fa0/4"],
    macTable: [
      { mac:"aa:aa:aa:00:00:01", port:"Fa0/1" },
      { mac:"aa:aa:aa:00:00:02", port:"Fa0/2" },
      { mac:"cc:cc:cc:00:00:03", port:"Fa0/3" },
      { mac:"dd:dd:dd:00:00:04", port:"Fa0/4" },
    ],
    frames: [
      { id:1, label:"Кадр 1", srcMac:"aa:aa:aa:00:00:01", dstMac:"cc:cc:cc:00:00:03", inPort:"Fa0/1", note:"Порт Fa0/1 общается с Fa0/3." },
      { id:2, label:"Кадр 2", srcMac:"aa:aa:aa:00:00:02", dstMac:"dd:dd:dd:00:00:04", inPort:"Fa0/2", note:"Порт Fa0/2 общается с Fa0/4." },
      { id:3, label:"Кадр 3", srcMac:"cc:cc:cc:00:00:03", dstMac:"aa:aa:aa:00:00:01", inPort:"Fa0/3", note:"Порт Fa0/3 общается с Fa0/1." },
      { id:4, label:"Кадр 4", srcMac:"dd:dd:dd:00:00:04", dstMac:"aa:aa:aa:00:00:02", inPort:"Fa0/4", note:"Порт Fa0/4 общается с Fa0/2." },
      { id:5, label:"Кадр 5", srcMac:"aa:aa:aa:00:00:02", dstMac: BCAST, inPort:"Fa0/2", note:"Это broadcast — свитч должен сделать флуд." },
    ],
  };

  function currentFrame(){ return S.frames[STATE.frameIndex || 0]; }

  function left(){
    const frame = currentFrame();
    return `
      <div class="panel">
        <h2>📇 Кто я — свитч ${S.name}</h2>
        <div style="font-size:12px;color:#9fb4d8;">Коммутатор L2. Работаю только с MAC-адресами.</div>
        <div style="margin-top:8px;font-size:12px;color:#7d8aa0;">Кадр: <b>${frame.id}/5</b> · ${frame.label}</div>
      </div>
      ${book("📖 MAC-таблица (CAM)", ["MAC","Порт"],
        S.macTable.map(m => ({cells:[m.mac, m.port], copy:null})))}`;
  }

  function right(){
    const frame = currentFrame();
    return `
      <div class="panel">
        <h2>🎯 Задача</h2>
        <div class="task">Кадр <b>${frame.id}/5</b> пришёл на порт <b>${frame.inPort}</b>.<br>
          <span style="color:#7d8aa0;">Посмотри dst MAC, найди его в MAC-таблице и выбери, как обработать кадр.</span></div>
        <button class="btn btn-hint" id="hintBtn">💡 Подсказка</button>
        <div class="note" id="hintText"></div>
      </div>

      <div class="panel">
        <h2>✉️ Входящий кадр</h2>
        <div class="envelope">
          <div class="env-label">Ethernet-кадр — пришёл на ${frame.inPort}</div>
          <div class="field"><label>src MAC</label><div class="fixed">${frame.srcMac}</div></div>
          <div class="field"><label>dst MAC</label><div class="fixed">${frame.dstMac}</div></div>
          <div class="field"><label>Payload</label><div class="fixed">данные…</div></div>
        </div>
      </div>

      <div class="panel">
        <h2>🔀 Решение: в какой порт форвардить?</h2>
        <div style="font-size:12px;color:#9fb4d8;margin-bottom:8px;">Кликни нужный порт ниже (он подсветится), либо выбери «Флуд».</div>
        <div class="ports" id="portList" style="margin-bottom:10px;"></div>
        <div class="radio-row">
          <button class="btn btn-secondary" id="floodBtn">📢 Флуд (во все порты, кроме входного)</button>
          <span id="selInfo" style="color:#7d8aa0;font-size:12px;"></span>
        </div>
        <button class="btn btn-start" id="startBtn">▶ START — обработать кадр</button>
        <button class="btn btn-secondary" id="nextFrameBtn" style="margin-top:10px;width:100%;" ${STATE.frameSolved?'':'disabled'}>➡ Следующий кадр</button>
      </div>

      <div class="panel"><h2>📡 Что произошло</h2>
        <div id="log"><span class="log-info">Кадр ${frame.id}/5 готов. Выбери порт или флуд и нажми START…</span></div></div>`;
  }

  function renderPorts(){
    const frame = currentFrame();
    el('portList').innerHTML = S.ports.map(p =>
      `<div class="port ${STATE.selPort===p?'selected':''}" data-port="${p}"><b>${p}</b></div>`).join('');
    el('portList').querySelectorAll('.port').forEach(pd => {
      pd.addEventListener('click', () => {
        STATE.selPort = pd.dataset.port; STATE.flood = false;
        el('selInfo').textContent = 'выбран порт ' + STATE.selPort;
        renderPorts();
      });
    });
    if (STATE.flood) {
      el('selInfo').textContent = 'выбран флуд';
    } else if (STATE.selPort) {
      el('selInfo').textContent = 'выбран порт ' + STATE.selPort;
    } else {
      el('selInfo').textContent = 'выбери действие';
    }
  }

  function render(){
    el('leftCol').innerHTML = left();
    el('rightCol').innerHTML = right();
    init();
  }

  function updateNextButton(){
    const btn = el('nextFrameBtn');
    if (btn) btn.disabled = !STATE.frameSolved;
  }

  function init(){
    if (!('frameIndex' in STATE)) STATE.frameIndex = 0;
    if (!('frameSolved' in STATE)) STATE.frameSolved = false;
    if (!('selPort' in STATE)) STATE.selPort = null;
    if (!('flood' in STATE)) STATE.flood = false;
    renderPorts();

    el('hintBtn').addEventListener('click', () => {
      const frame = currentFrame();
      if (frame.dstMac === BCAST) {
        el('hintText').innerHTML = '💡 Это <b>broadcast</b>. Для него свитч не выбирает один порт — он делает <b>флуд</b> во все порты, кроме входного.';
      } else {
        el('hintText').innerHTML = '💡 Возьми <b>dst MAC</b> кадра (' + frame.dstMac + ') и найди его строку в MAC-таблице. '
          + 'Там указан порт — туда и форвардь. Не забудь: во входной порт кадр не отправляют.';
      }
    });

    el('floodBtn').addEventListener('click', () => {
      STATE.flood = true; STATE.selPort = null;
      el('selInfo').textContent = 'выбран флуд';
      renderPorts();
    });

    el('startBtn').addEventListener('click', () => {
      const frame = currentFrame();
      const entry = S.macTable.find(m => m.mac === frame.dstMac);
      const correctPort = entry ? entry.port : null;

      if (!STATE.flood && !STATE.selPort) return fail('Сначала выбери порт или «Флуд».');

      if (frame.dstMac === BCAST) {
        if (!STATE.flood) {
          return fail('Это <b>broadcast</b>. Для broadcast свитч делает <b>флуд</b> во все порты, кроме входного.');
        }
        STATE.frameSolved = true;
        updateNextButton();
        log(`<span class="emoji">🎉</span> <span class="log-ok">Кадр ${frame.id}/5 обработан правильно!</span>\n\n`
          + `<span class="log-step">1. dst MAC ${frame.dstMac} — broadcast.</span>\n`
          + `<span class="log-step">2. Свитч разослал кадр во все порты, кроме ${frame.inPort}.</span>\n`
          + `<span class="log-step">3. Это стандартное поведение для broadcast.</span>\n\n`
          + `<span class="log-info">Так работает <b>broadcast</b>: MAC неизвестен/широковещательный — делаем флуд.</span>`);
        return;
      }

      if (STATE.flood) {
        return fail('Ты выбрал флуд, но dst MAC <b>' + frame.dstMac + '</b> ЕСТЬ в MAC-таблице (порт ' + correctPort + '). '
          + 'Флуд нужен, только когда MAC неизвестен или кадр broadcast. Здесь — точечный форвард в ' + correctPort + '.');
      }
      if (STATE.selPort === frame.inPort) {
        return fail('Нельзя форвардить кадр обратно во <b>входной</b> порт (' + frame.inPort + '). Свитч так не делает.');
      }
      if (STATE.selPort !== correctPort) {
        return fail('Порт ' + STATE.selPort + ' неверный. dst MAC ' + frame.dstMac + ' по MAC-таблице находится на порту <b>' + correctPort + '</b>.');
      }
      STATE.frameSolved = true;
      updateNextButton();
      log(`<span class="emoji">🎉</span> <span class="log-ok">Кадр ${frame.id}/5 обработан правильно!</span>\n\n`
        + `<span class="log-step">1. dst MAC ${frame.dstMac} найден в MAC-таблице → порт ${correctPort}.</span>\n`
        + `<span class="log-step">2. Кадр отправлен только в ${correctPort} (unicast, без флуда).</span>\n`
        + `<span class="log-step">3. Заодно свитч выучил src MAC ${frame.srcMac} → порт ${frame.inPort}.</span>\n\n`
        + `<span class="log-info">Так работает <b>known unicast</b>: MAC известен → точечная доставка.</span>`);
    });

    el('nextFrameBtn').addEventListener('click', () => {
      if (STATE.frameIndex < S.frames.length - 1) {
        STATE.frameIndex += 1;
        STATE.frameSolved = false;
        STATE.selPort = null;
        STATE.flood = false;
        render();
      } else {
        STATE.frameSolved = true;
        log(`<span class="emoji">✅</span> <span class="log-ok">Все 5 кадров пройдены!</span>\n\n`
          + `<span class="log-step">Свитч успешно обработал unicast и broadcast.</span>`);
      }
    });
  }

  return { roleSub:'Роль: <b>свитч SW1</b>. Пройди 5 кадров: unicast + broadcast.', render, left, right, init };
})();

// ------------------------------------------------------------
//  УРОВЕНЬ 3b — Свитч: unknown unicast → flood → learn → forward
// ------------------------------------------------------------
LEVELS["3b"] = (function(){
  const S = {
    name: "SW1",
    ports: ["Fa0/1","Fa0/2","Fa0/3","Fa0/4"],
    baseMacTable: [
      { mac:"aa:aa:aa:00:00:01", port:"Fa0/1" },
    ],
    macTable: [
      { mac:"aa:aa:aa:00:00:01", port:"Fa0/1" },
    ],
    frames: [
      { id:1, label:"Кадр 1", srcMac:"aa:aa:aa:00:00:02", dstMac:"dd:dd:dd:00:00:09", inPort:"Fa0/2", note:"Порт Fa0/2 отправляет неизвестный unicast." },
      { id:2, label:"Кадр 2", srcMac:"dd:dd:dd:00:00:09", dstMac:"aa:aa:aa:00:00:02", inPort:"Fa0/3", note:"Это ответный кадр. Теперь dst MAC известен, и кадр идёт на Fa0/2." },
      { id:3, label:"Кадр 3", srcMac:"aa:aa:aa:00:00:02", dstMac:"dd:dd:dd:00:00:09", inPort:"Fa0/2", note:"Теперь dst MAC уже изучен после ответа — отправляем в нужный порт, а не во флуд." },
      { id:4, label:"Кадр 4", srcMac:"cc:cc:cc:00:00:03", dstMac:"aa:aa:aa:00:00:01", inPort:"Fa0/3", note:"Ещё один unicast: dst MAC уже известен и находится на Fa0/1." },
      { id:5, label:"Кадр 5", srcMac:"dd:dd:dd:00:00:04", dstMac:"cc:cc:cc:00:00:03", inPort:"Fa0/4", note:"И ещё один пример: после обучения MAC отправляем точечно на Fa0/3." },
    ],
  };

  function currentFrame(){
    const frame = S.frames[STATE.frameIndex || 0];
    if (frame) learnMac(frame.srcMac, frame.inPort);
    return frame;
  }

  function learnMac(mac, port){
    const entry = S.macTable.find(m => m.mac === mac);
    if (entry) {
      entry.port = port;
    } else {
      S.macTable.push({ mac, port });
    }
  }

  function getEntry(mac){
    return S.macTable.find(m => m.mac === mac) || null;
  }

  function left(){
    const frame = currentFrame();
    return `
      <div class="panel">
        <h2>📇 Кто я — свитч ${S.name}</h2>
        <div style="font-size:12px;color:#9fb4d8;">Коммутатор L2. Работаю только с MAC-адресами.</div>
        <div style="margin-top:8px;font-size:12px;color:#7d8aa0;">Кадр: <b>${frame.id}/5</b> · ${frame.label}</div>
      </div>
      ${book("📖 MAC-таблица (CAM)", ["MAC","Порт"],
        S.macTable.map(m => ({cells:[m.mac, m.port], copy:null})))}`;
  }

  function right(){
    const frame = currentFrame();
    return `
      <div class="panel">
        <h2>🎯 Задача</h2>
        <div class="task">Кадр <b>${frame.id}/5</b> пришёл на порт <b>${frame.inPort}</b>.<br>
          ${frame.note}</div>
        <button class="btn btn-hint" id="hintBtn">💡 Подсказка</button>
        <div class="note" id="hintText"></div>
      </div>

      <div class="panel">
        <h2>✉️ Входящий кадр</h2>
        <div class="envelope">
          <div class="env-label">Ethernet-кадр — пришёл на ${frame.inPort}</div>
          <div class="field"><label>src MAC</label><div class="fixed">${frame.srcMac}</div></div>
          <div class="field"><label>dst MAC</label><div class="fixed">${frame.dstMac}</div></div>
          <div class="field"><label>Payload</label><div class="fixed">данные…</div></div>
        </div>
      </div>

      <div class="panel">
        <h2>🔀 Решение: что делать?</h2>
        <div style="font-size:12px;color:#9fb4d8;margin-bottom:8px;">Если dst MAC нет в таблице — делай <b>flood</b>. Если есть — выбирай точный порт.</div>
        <div class="ports" id="portList" style="margin-bottom:10px;"></div>
        <div class="radio-row">
          <button class="btn btn-secondary" id="floodBtn">📢 Флуд (во все порты, кроме входного)</button>
          <span id="selInfo" style="color:#7d8aa0;font-size:12px;"></span>
        </div>
        <button class="btn btn-start" id="startBtn">▶ START — обработать кадр</button>
        <button class="btn btn-secondary" id="nextFrameBtn" style="margin-top:10px;width:100%;" ${STATE.frameSolved?'':'disabled'}>➡ Следующий кадр</button>
      </div>

      <div class="panel"><h2>📡 Что произошло</h2>
        <div id="log"><span class="log-info">Кадр ${frame.id}/5 готов. Выбери действие и нажми START…</span></div></div>`;
  }

  function renderPorts(){
    const frame = currentFrame();
    el('portList').innerHTML = S.ports.map(p =>
      `<div class="port ${STATE.selPort===p?'selected':''}" data-port="${p}"><b>${p}</b></div>`).join('');
    el('portList').querySelectorAll('.port').forEach(pd => {
      pd.addEventListener('click', () => {
        STATE.selPort = pd.dataset.port; STATE.flood = false;
        el('selInfo').textContent = 'выбран порт ' + STATE.selPort;
        renderPorts();
      });
    });
    if (STATE.flood) {
      el('selInfo').textContent = 'выбран флуд';
    } else if (STATE.selPort) {
      el('selInfo').textContent = 'выбран порт ' + STATE.selPort;
    } else {
      el('selInfo').textContent = 'выбери действие';
    }
  }

  function render(){
    el('leftCol').innerHTML = left();
    el('rightCol').innerHTML = right();
    init();
  }

  function refreshLeft(){
    el('leftCol').innerHTML = left();
  }

  function updateNextButton(){
    const btn = el('nextFrameBtn');
    if (btn) btn.disabled = !STATE.frameSolved;
  }

  function resetScenario(){
    S.macTable = S.baseMacTable.map(m => ({ ...m }));
    STATE.frameIndex = 0;
    STATE.frameSolved = false;
    STATE.selPort = null;
    STATE.flood = false;
  }

  function init(){
    if (!('frameIndex' in STATE)) resetScenario();
    if (!('frameSolved' in STATE)) STATE.frameSolved = false;
    if (!('selPort' in STATE)) STATE.selPort = null;
    if (!('flood' in STATE)) STATE.flood = false;
    renderPorts();
    updateNextButton();

    el('hintBtn').addEventListener('click', () => {
      const frame = currentFrame();
      const entry = S.macTable.find(m => m.mac === frame.dstMac);
      if (!entry) {
        el('hintText').innerHTML = '💡 dst MAC <b>' + frame.dstMac + '</b> сейчас нет в MAC-таблице. Это <b>unknown unicast</b>. '
          + 'Свитч должен сделать <b>flood</b>, чтобы выяснить, куда отправить кадр, и выучить MAC по входу.';
      } else {
        el('hintText').innerHTML = '💡 dst MAC <b>' + frame.dstMac + '</b> уже есть в MAC-таблице — отправляй кадр только в порт <b>' + entry.port + '</b>.';
      }
    });

    el('floodBtn').addEventListener('click', () => {
      STATE.flood = true; STATE.selPort = null;
      el('selInfo').textContent = 'выбран флуд';
      renderPorts();
    });

    el('startBtn').addEventListener('click', () => {
      const frame = currentFrame();
      const entry = S.macTable.find(m => m.mac === frame.dstMac);
      const correctPort = entry ? entry.port : null;

      if (!STATE.flood && !STATE.selPort) return fail('Сначала выбери порт или «Флуд».');

      if (!entry) {
        if (!STATE.flood) {
          return fail('dst MAC <b>' + frame.dstMac + '</b> сейчас нет в MAC-таблице. Для unknown unicast нужен <b>флуд</b>.');
        }
        learnMac(frame.srcMac, frame.inPort);
        STATE.frameSolved = true;
        updateNextButton();
        refreshLeft();
        const flooded = S.ports.filter(p => p !== frame.inPort).join(', ');
        const learnMessage = `<span class="log-step">3. Свитч выучил src MAC ${frame.srcMac} → порт ${frame.inPort}.</span>`;
        log(`<span class="emoji">🎉</span> <span class="log-ok">Кадр ${frame.id}/5 обработан правильно!</span>\n\n`
          + `<span class="log-step">1. dst MAC ${frame.dstMac} НЕ найден в MAC-таблице (unknown unicast).</span>\n`
          + `<span class="log-step">2. Кадр разослан во все порты, кроме ${frame.inPort}: ${flooded}.</span>\n`
          + learnMessage + `\n\n`
          + `<span class="log-info">Так работает <b>unknown unicast</b>: свитч не знает, куда направить кадр, поэтому делает <b>flood</b>.</span>`);
        return;
      }

      if (STATE.flood) {
        return fail('Ты выбрал флуд, но dst MAC <b>' + frame.dstMac + '</b> уже есть в MAC-таблице на порту <b>' + correctPort + '</b>. Здесь нужен точечный форвард.');
      }
      if (STATE.selPort === frame.inPort) {
        return fail('Нельзя форвардить кадр обратно во <b>входной</b> порт (' + frame.inPort + ').');
      }
      if (STATE.selPort !== correctPort) {
        return fail('Порт ' + STATE.selPort + ' неверный. dst MAC ' + frame.dstMac + ' находится на порту <b>' + correctPort + '</b>.');
      }
      learnMac(frame.srcMac, frame.inPort);
      STATE.frameSolved = true;
      updateNextButton();
      refreshLeft();
      log(`<span class="emoji">🎉</span> <span class="log-ok">Кадр ${frame.id}/5 обработан правильно!</span>\n\n`
        + `<span class="log-step">1. dst MAC ${frame.dstMac} найден в MAC-таблице → порт ${correctPort}.</span>\n`
        + `<span class="log-step">2. Кадр отправлен только в ${correctPort}.</span>\n`
        + `<span class="log-step">3. Свитч выучил src MAC ${frame.srcMac} → порт ${frame.inPort}.</span>\n\n`
        + `<span class="log-info">Так работает <b>known unicast</b>: MAC уже известен → точечный форвард.</span>`);
    });

    el('nextFrameBtn').addEventListener('click', () => {
      if (STATE.frameIndex < S.frames.length - 1) {
        STATE.frameIndex += 1;
        STATE.frameSolved = false;
        STATE.selPort = null;
        STATE.flood = false;
        render();
      } else {
        STATE.frameSolved = true;
        log(`<span class="emoji">✅</span> <span class="log-ok">Все 5 кадров пройдены!</span>\n\n`
          + `<span class="log-step">Свитч успешно обработал unknown unicast и known unicast.</span>`);
      }
    });
  }

  return { roleSub:'Роль: <b>свитч SW1</b>. Пройди 5 кадров: flood → learn → forward.', render, left, right, init };
})();

// -------------------- СТАРТ --------------------
loadLevel("1");
