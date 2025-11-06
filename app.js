// app.js (namespaced Firebase v8)
// Assumes firebase-config.js already initialized firebase, auth, db globals

// helper $
const $ = id => document.getElementById(id);

// hide loader
window.addEventListener('load', ()=> setTimeout(()=> { const L = $('loader'); if(L) L.style.display='none'; }, 300));

// AUTH UI (header)
const authBtn = $('auth-btn');
const navProfile = $('nav-profile');

// update header on auth change
firebase.auth().onAuthStateChanged(user => {
  if(authBtn) {
    if(user) {
      authBtn.textContent = 'Logout';
      authBtn.onclick = () => firebase.auth().signOut();
      if(navProfile) navProfile.style.display = 'inline-block';
    } else {
      authBtn.textContent = 'Login';
      authBtn.onclick = () => {
        const useGoogle = confirm('Login with Google? (Cancel = GitHub)');
        if(useGoogle) {
          const provider = new firebase.auth.GoogleAuthProvider();
          firebase.auth().signInWithPopup(provider).catch(e=>alert(e.message));
        } else {
          const provider = new firebase.auth.GithubAuthProvider();
          firebase.auth().signInWithPopup(provider).catch(e=>alert(e.message));
        }
      };
      if(navProfile) navProfile.style.display = 'none';
    }
  }
});

// ---------- LOAD PROJECTS (index) ----------
async function loadProjects(){
  const el = $('projects'); if(!el) return;
  const snap = await firebase.firestore().collection('projects').orderBy('createdAt','desc').get();
  const list = [];
  snap.forEach(s => {
    const d = s.data();
    if(d.approved !== false) list.push({id:s.id,...d});
  });

  const render = (arr) => {
    el.innerHTML = arr.map(d => `
      <div class="card">
        <img class="thumb" src="${d.thumbnail || 'assets/thumbnail.jpg'}" />
        <div class="meta">
          <h3>${escapeHtml(d.title)}</h3>
          <p>${escapeHtml((d.desc||'').slice(0,140))}</p>
          <div class="meta-line">
            <span>by ${escapeHtml(d.ownerName || 'Unknown')}</span>
            <span>• ${d.downloads||0} downloads</span>
            <span>• ${d.totalDonated||0} VND</span>
          </div>
          <div class="actions"><a class="btn-sm" href="detail.html?id=${d.id}">Chi tiết</a></div>
        </div>
      </div>
    `).join('');
  };

  render(list);

  const input = $('searchInput'); const filter = $('filter');
  if(input) {
    input.oninput = () => {
      const qv = input.value.toLowerCase();
      const fv = filter.value;
      const r = list.filter(x => (x.title+x.desc+(x.tags||'')+(x.ownerName||'')).toLowerCase().includes(qv) && (fv==='' || (x.tags||'').includes(fv)));
      render(r);
    };
  }
}
loadProjects();

// ---------- DETAIL PAGE ----------
async function loadDetail(){
  if(!$('title')) return; // not on detail page
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if(!id) return;
  const snap = await firebase.firestore().collection('projects').doc(id).get();
  if(!snap.exists) { $('title').innerText='Not found'; return; }
  const d = snap.data();
  $('banner').src = d.thumbnail || 'assets/thumbnail.jpg';
  $('title').innerText = d.title || '—';
  $('desc').innerText = d.desc || '—';
  $('openRepo').href = d.repo || '#';
  $('meta').innerHTML = `Owner: ${d.ownerName||'Unknown'} • ${d.downloads||0} downloads • ${d.totalDonated||0} VND`;

  $('downloadBtn').onclick = async ()=>{
    await firebase.firestore().collection('projects').doc(id).update({ downloads: firebase.firestore.FieldValue.increment(1) });
    alert('Download recorded');
  };

  $('donateBtn').onclick = async ()=>{
    const amt = prompt('Nhập số tiền donate (VND):');
    if(!amt) return;
    const user = firebase.auth().currentUser;
    if(!user){ alert('Bạn cần đăng nhập'); return; }
    await firebase.firestore().collection('donations').add({ projectId:id, userId:user.uid, amount:Number(amt), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    await firebase.firestore().collection('projects').doc(id).update({ totalDonated: firebase.firestore.FieldValue.increment(Number(amt)) });
    alert('Cảm ơn đã donate!');
  };
}
loadDetail();

// ---------- SHARE PAGE ----------
function shareHandler(){
  const form = $('shareForm'); if(!form) return;
  const msg = $('share-auth-msg');
  firebase.auth().onAuthStateChanged(user=>{
    if(!user) { if(msg) msg.innerHTML = '<p>Vui lòng đăng nhập để chia sẻ</p>'; }
    else { if(msg) msg.innerHTML = `<p>Đăng nhập: ${user.displayName||user.email}</p>`; }
  });

  form.onsubmit = async (e)=>{
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if(!user){ alert('Bạn cần đăng nhập'); return; }
    const title = document.getElementById('title').value.trim();
    const repo = document.getElementById('repo').value.trim();
    const thumbnail = document.getElementById('thumbnail').value.trim();
    const tags = document.getElementById('tags').value.trim().toLowerCase();
    const desc = document.getElementById('desc').value.trim();
    if(title.length<3 || repo.length<10){ alert('Vui lòng nhập đầy đủ'); return; }
    await firebase.firestore().collection('projects').add({
      title, repo, thumbnail, tags, desc,
      ownerId: user.uid, ownerName: user.displayName || user.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), downloads:0, totalDonated:0, approved:false
    });
    alert('Đã gửi cho admin duyệt. Cảm ơn!');
    location.href = 'index.html';
  };
}
shareHandler();

// ---------- LEADERBOARD ----------
async function loadLeaderboard(){
  const projSnap = await firebase.firestore().collection('projects').get();
  const mapP = {}, mapD = {};
  const projects = [];
  projSnap.forEach(s => {
    const d = s.data();
    projects.push({id:s.id,...d});
    if(d.ownerId) mapP[d.ownerId] = (mapP[d.ownerId]||0)+1;
  });

  const donSnap = await firebase.firestore().collection('donations').get();
  donSnap.forEach(s => { const d=s.data(); if(d.userId) mapD[d.userId] = (mapD[d.userId]||0) + (d.amount||0); });

  const topDownloads = projects.slice().sort((a,b)=>(b.downloads||0)-(a.downloads||0)).slice(0,8);

  const topSharersArr = Object.entries(mapP).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const topDonorsArr = Object.entries(mapD).sort((a,b)=>b[1]-a[1]).slice(0,8);

  if($('top-sharers')) $('top-sharers').innerHTML = topSharersArr.map(x=>`<div style="padding:8px">${escapeHtml(x[0])} — ${x[1]} repos</div>`).join('') || 'No data';
  if($('top-donors')) $('top-donors').innerHTML = topDonorsArr.map(x=>`<div style="padding:8px">${escapeHtml(x[0])} — ${x[1]} VND</div>`).join('') || 'No data';
  if($('top-downloads')) $('top-downloads').innerHTML = topDownloads.map(x=>`<div style="padding:8px">${escapeHtml(x.title)} — ${x.downloads||0}</div>`).join('') || 'No data';
}
loadLeaderboard();

// ---------- PROFILE ----------
function loadProfile(){
  const box = $('profileBox'); if(!box) return;
  firebase.auth().onAuthStateChanged(async user=>{
    if(!user){ box.innerHTML = '<p>Vui lòng đăng nhập</p>'; return; }
    box.innerHTML = `<div><strong>${escapeHtml(user.displayName||user.email)}</strong><p>${escapeHtml(user.email)}</p></div>`;
    const q = await firebase.firestore().collection('projects').where('ownerId','==',user.uid).get();
    const list = [];
    q.forEach(s => { const d=s.data(); list.push(`<div class="card" style="margin-top:12px"><h4>${escapeHtml(d.title)}</h4><p>${escapeHtml(d.desc||'')}</p></div>`); });
    $('myProjects').innerHTML = list.join('') || '<p>Chưa có project</p>';
  });
}
loadProfile();

// ---------- ADMIN ----------
async function loadAdmin(){
  const el = $('adminList'); if(!el) return;
  const user = firebase.auth().currentUser;
  if(!user){ el.innerHTML = '<p>Vui lòng đăng nhập admin</p>'; return; }

  // check adminEmails collection
  const adminSnap = await firebase.firestore().collection('adminEmails').get();
  const adminEmails = adminSnap.docs.map(d => d.data().email);
  if(!adminEmails.includes(user.email)){ el.innerHTML = '<p>Bạn không có quyền admin</p>'; return; }

  const snap = await firebase.firestore().collection('projects').get();
  el.innerHTML = snap.docs.map(s => {
    const d = s.data();
    return `<div class="card" style="margin-bottom:8px;padding:12px">
      <h4>${escapeHtml(d.title)}</h4>
      <p>${escapeHtml(d.desc||'')}</p>
      <div style="margin-top:8px">
        <button data-id="${s.id}" class="approve">Approve</button>
        <button data-id="${s.id}" class="del">Delete</button>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.approve').forEach(b=>{
    b.onclick = async ()=> {
      const id = b.getAttribute('data-id');
      await firebase.firestore().collection('projects').doc(id).update({ approved: true });
      alert('Approved');
      loadAdmin();
    };
  });
  document.querySelectorAll('.del').forEach(b=>{
    b.onclick = async ()=> {
      const id = b.getAttribute('data-id');
      if(!confirm('Delete?')) return;
      await firebase.firestore().collection('projects').doc(id).delete();
      alert('Deleted');
      loadAdmin();
    };
  });
}
loadAdmin();

// ---------- utilities ----------
function escapeHtml(s){ if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }