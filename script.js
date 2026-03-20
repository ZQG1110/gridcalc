document.addEventListener('DOMContentLoaded', () => {
    // --- Supabase Config ---
    const SUPABASE_URL = 'https://doqokgxyvmtwqdbypsls.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_cxc9U_-f6iaTvoW_OXx74w_q-TGhluz';
    
    // 글로벌 supabase 객체를 사용하여 클라이언트 인스턴스 생성 (안전하게 감쌈)
    let supabaseClient = null;
    try {
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.warn('Supabase 라이브러리가 로드되지 않았습니다.');
        }
    } catch (e) {
        console.error('Supabase 초기화 오류:', e);
    }

    // --- State ---
    let currentUser = null; 
    let currentUserId = null; 
    
    // Simulator State
    let holdings = []; 
    let sellHistory = [];
    let idSeq = 1;
    let selectedSellBatchId = null;

    // Social & Blog State
    let profitPosts = [];
    let blogPosts = [];
    let lastSeenComments = {};

    // --- Navigation & Core Elements ---
    const navBtns = document.querySelectorAll('.main-nav .nav-btn');
    const viewSections = document.querySelectorAll('.view-section');
    const btnOpenLogin = document.getElementById('btnOpenLogin');
    const btnOpenSignup = document.getElementById('btnOpenSignup');
    const userInfo = document.getElementById('userInfo');
    const labelUsername = document.getElementById('labelUsername');
    const btnLogout = document.getElementById('btnLogout');
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    const navMyPage = document.getElementById('navMyPage');

    // --- Simulator Elements ---
    const buyForm = document.getElementById('buyForm');
    const sellForm = document.getElementById('sellForm');
    const feeRateInput = document.getElementById('feeRate');
    
    const buyPriceInput = document.getElementById('buyPrice');
    const buyAmountInput = document.getElementById('buyAmount');
    const qtyPreview = document.querySelector('#qtyPreview span');
    
    const dropSuggestion = document.getElementById('dropSuggestion');
    const btnDropBuy = document.getElementById('btnDropBuy');
    const dropPriceSpan = document.getElementById('dropPrice');
    const dropAmountSpan = document.getElementById('dropAmount');

    const sellPriceInput = document.getElementById('sellPrice');
    const sellQtyInput = document.getElementById('sellQty');
    
    const currentPriceInput = document.getElementById('currentPrice');
    const returnRateSpan = document.querySelector('.return-rate');
    const returnAmountSpan = document.querySelector('.return-amount');

    const topAvgPriceEl = document.getElementById('topAvgPrice');
    const topTotalQtyEl = document.getElementById('topTotalQty');
    const topTotalInvestEl = document.getElementById('topTotalInvest');
    const totalRealizedProfitEl = document.getElementById('totalRealizedProfit');

    const holdingsBody = document.getElementById('holdingsBody');
    const historyBody = document.getElementById('historyBody');

    // --- Supabase Sync & Init ---
    async function initApp() {
        // 1. 새로고침 시 보던 탭 즉시 복구 (데이터 로딩 전 실행하여 깜빡임 방지)
        const lastView = localStorage.getItem('gridCalcActiveView') || 'view-intro';
        switchView(lastView);

        // 초기 UI 상태 설정
        updateAuthUI();
        
        // 초기 세션 확인
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            currentUser = session.user.email.split('@')[0];
            currentUserId = session.user.id;
        } else {
            currentUser = null;
            currentUserId = null;
        }

        updateAuthUI(); // 세션 확인 후 UI 다시 업데이트
        
        // 데이터 병렬 로드 (속도 최적화)
        await Promise.all([
            fetchPosts(),
            fetchBlogPosts(),
            currentUserId ? loadSimulatorState() : Promise.resolve()
        ]);

        updateSimulatorUI();
        checkNotifications();
    }

    initApp();

    // Supabase Auth 상태 변경 리스너
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log("Auth Event:", event);
            
            // 로그인/로그아웃 시 상태 변경
            if (session && session.user) {
                const newUser = session.user.email.split('@')[0];
                const newId = session.user.id;
                
                // 실제로 유저가 바뀌었을 때만 리로딩 (불필요한 요청 방지)
                if (currentUserId !== newId) {
                    currentUser = newUser;
                    currentUserId = newId;
                    updateAuthUI();
                    loadSimulatorState().then(updateSimulatorUI);
                }
            } else if (!session && currentUserId !== null) {
                currentUser = null;
                currentUserId = null;
                updateAuthUI();
                updateSimulatorUI(); 
            }
        });

    // --- Navigation & Core Elements ---
    function switchView(targetId) {
        if (!targetId) return;

        // 1. 현재 탭 저장 및 UI 상태 변경 (즉시 실행)
        localStorage.setItem('gridCalcActiveView', targetId);

        // 모든 메뉴 버튼 활성 상태 초기화
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        // 타겟 버튼 활성화
        const targetBtn = document.querySelector(`.nav-btn[data-target="${targetId}"]`) || 
                         (targetId === 'view-mypage' ? navMyPage : null);
        if (targetBtn) targetBtn.classList.add('active');

        // 섹션 전환
        viewSections.forEach(v => {
            if (v.id === targetId) {
                v.classList.remove('hidden');
                v.classList.add('active');
            } else {
                v.classList.remove('active');
                v.classList.add('hidden');
            }
        });

        // 2. 페이지 데이터 데이터 새로고침 (비동기 처리)
        if (targetId === 'view-profit') fetchPosts();
        if (targetId === 'view-blog') fetchBlogPosts();
        if (targetId === 'view-simulator' && currentUserId) loadSimulatorState().then(updateSimulatorUI);
        if (targetId === 'view-mypage') {
            renderMyPage();
            // 알림 제거 로직
            if (currentUser) {
                const myP = profitPosts.filter(p => p.user === currentUser);
                myP.forEach(p => {
                    lastSeenComments[p.id] = p.comments.length;
                });
                localStorage.setItem('gridCalcNoti', JSON.stringify(lastSeenComments));
                checkNotifications();
            }
        }
    }

    // 로고 클릭 (홈으로)
    const logoHome = document.getElementById('logoHome');
    logoHome.addEventListener('click', () => switchView('view-simulator'));

    // 버튼들에 이벤트 리스너 연결
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if (target) switchView(target);
        });
    });

    // 마이페이지는 .nav-btn 리스너에서 이미 처리됨 (switchView 상단에서 data-target으로 캐치)

    btnOpenLogin.addEventListener('click', () => {
        isSignupMode = false;
        document.querySelector('.login-box h2').textContent = 'GRIDCALC 로그인';
        document.querySelector('#loginForm button').textContent = '시작하기';
        loginUsername.value = ''; loginPassword.value = '';
        loginModal.classList.add('show');
    });
    btnOpenSignup.addEventListener('click', () => {
        isSignupMode = true;
        document.querySelector('.login-box h2').textContent = 'GRIDCALC 회원가입';
        document.querySelector('#loginForm button').textContent = '가입하기';
        loginUsername.value = ''; loginPassword.value = '';
        loginModal.classList.add('show');
    });
    document.querySelectorAll('.login-close').forEach(btn => {
        btn.addEventListener('click', () => loginModal.classList.remove('show'));
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginUsername.value.trim();
        const password = loginPassword.value.trim();
        
        if (!username || !password) return;

        // Supabase Auth는 이메일을 기본으로 합니다. 
        // 편의를 위해 입력된 닉네임을 이메일 형식으로 변환하여 사용합니다.
        const email = username.includes('@') ? username : `${username}@gridcalc.com`;

        try {
            if (!supabaseClient) {
                throw new Error('서버 연결 라이브러리가 로드되지 않았습니다. 인터넷 상태를 확인해 주세요.');
            }

            if (isSignupMode) {
                // 1. 회원가입 모드
                if (username === 'admin') { 
                    alert('admin은 시스템 예약 계정입니다.'); 
                    return; 
                }
                if (password.length < 6) {
                    alert('비밀번호는 최소 6자 이상이어야 합니다.');
                    return;
                }

                const { data, error } = await supabaseClient.auth.signUp({ 
                    email, 
                    password,
                    options: {
                        data: { display_name: username } 
                    }
                });

                if (error) {
                    if (error.message.includes('already registered')) {
                        throw new Error('이미 존재하는 계정입니다. 로그인으로 진행해 주세요.');
                    }
                    throw error;
                }

                alert('회원가입이 완료되었습니다! 이제 로그인을 시도해 주세요.');
                isSignupMode = false;
                document.querySelector('.login-box h2').textContent = 'GRIDCALC 로그인';
                document.querySelector('#loginForm button').textContent = '시작하기';
                loginPassword.value = '';
                // 가입 직후에는 로그인을 유도 (이메일 인증 OFF 시 자동 로그인도 가능하지만 안전을 위해 안내)
            } else {
                // 2. 로그인 모드
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                
                if (error) {
                    if (error.message.includes('Invalid login credentials')) {
                        throw new Error('아이디 또는 비밀번호가 일치하지 않습니다. (관리자 계정은 대시보드에서 먼저 생성해야 합니다)');
                    }
                    if (error.message.includes('Email not confirmed')) {
                        throw new Error('이메일 인증이 필요합니다. (Supabase 대시보드에서 "Confirm Email" 기능을 끄시면 인증 없이 바로 사용 가능합니다)');
                    }
                    throw error;
                }
                
                loginModal.classList.remove('show');
            }
            
            // 상태 업데이트는 onAuthStateChange 리스너에서 처리됨
        } catch (err) {
            console.error("Auth Error Detail:", err);
            let msg = '알 수 없는 오류가 발생했습니다.';
            if (typeof err === 'string') msg = err;
            else if (err.message) msg = err.message;
            else if (err.error_description) msg = err.error_description;
            else msg = JSON.stringify(err);

            if (msg === '{}' || msg === 'undefined') msg = '서버 설정 오류 또는 네트워크 문제입니다. (비밀번호 6자 이상 확인 및 Supabase 설정 확인 필요)';
            
            alert(`오류 발생: ${msg}`);
        }
    });

    btnLogout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        // 리디렉션 로직
        const activeNav = document.querySelector('.nav-btn.active');
        if (activeNav && activeNav.dataset.target === 'view-mypage') {
            document.querySelector('[data-target="view-intro"]').click();
        }
    });

    function updateAuthUI() {
        if (currentUser) {
            btnOpenLogin.classList.add('hidden');
            btnOpenSignup.classList.add('hidden');
            userInfo.classList.remove('hidden');
            navMyPage.classList.remove('hidden');
            labelUsername.textContent = currentUser + (currentUser === 'admin' ? ' (관리자)' : '');
            
            if (currentUser === 'admin' || currentUser.startsWith('admin')) {
                document.getElementById('blogAdminPanel').classList.remove('hidden');
            } else {
                document.getElementById('blogAdminPanel').classList.add('hidden');
            }
        } else {
            btnOpenLogin.classList.remove('hidden');
            btnOpenSignup.classList.remove('hidden');
            userInfo.classList.add('hidden');
            navMyPage.classList.add('hidden');
            document.getElementById('blogAdminPanel').classList.add('hidden');
        }
    }

    function checkNotifications() {
        const notiSpan = document.getElementById('myPageNoti');
        if (!notiSpan) return;
        if (!currentUser) {
            notiSpan.style.display = 'none';
            return;
        }

        let hasNew = false;
        const myP = profitPosts.filter(p => p.user === currentUser);
        for (const p of myP) {
            const seen = lastSeenComments[p.id] || 0;
            if (p.comments.length > seen) {
                hasNew = true;
                break;
            }
        }
        
        notiSpan.style.display = hasNew ? 'block' : 'none';
    }

    // --- Simulator Logic (Supabase) ---
    async function loadSimulatorState() {
        if (!currentUserId) {
            // 로그인 상태가 아니면 초기화
            holdings = []; sellHistory = []; idSeq = 1;
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('simulator_states')
            .select('data')
            .eq('user_id', currentUserId)
            .single();

        if (data && data.data) {
            const p = data.data;
            holdings = p.holdings || [];
            sellHistory = p.sellHistory || [];
            idSeq = p.idSeq || 1;
            if(p.feeRate !== undefined) feeRateInput.value = p.feeRate;
        } else {
            holdings = []; sellHistory = []; idSeq = 1;
        }
    }

    async function saveSimulatorState() {
        if (!currentUserId) return; // 로그인 필수

        const stateData = {holdings, sellHistory, idSeq, feeRate: feeRateInput.value};
        const { error } = await supabaseClient
            .from('simulator_states')
            .upsert({ user_id: currentUserId, data: stateData, updated_at: new Date() });
        
        if (error) console.error('상태 저장 실패:', error);
    }

    feeRateInput.addEventListener('input', () => {
        saveSimulatorState();
        updateSimulatorUI();
    });

    buyPriceInput.addEventListener('input', calculatePreview);
    buyAmountInput.addEventListener('input', calculatePreview);
    currentPriceInput.addEventListener('input', calculateCurrentReturn);

    function calculatePreview() {
        const p = parseFloat(buyPriceInput.value) || 0;
        const a = parseFloat(buyAmountInput.value) || 0;
        qtyPreview.textContent = (p > 0 && a > 0) ? Math.floor(a / p).toLocaleString() : '0';
    }

    buyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const price = parseFloat(buyPriceInput.value);
        const amount = parseFloat(buyAmountInput.value);
        const feeRate = parseFloat(feeRateInput.value) || 0;

        if (price > 0 && amount > 0) {
            const qty = Math.floor(amount / price);
            if (qty <= 0) { alert('단가가 금액보다 커서 수량이 0주입니다.'); return; }
            
            // Calculate investment cost keeping fee in mind
            const rawCost = price * qty;
            const actualCost = rawCost * (1 + (feeRate / 100));

            const batch = holdings.length > 0 ? Math.max(...holdings.map(h => h.batch)) + 1 : 1;
            
            holdings.push({
                id: idSeq++, batch, price, qty, initialQty: qty,
                actualCost: actualCost, // Total cost spent including fee
                originalAmount: amount, // Save the original amount entered
                date: new Date().toLocaleString()
            });

            buyPriceInput.value = ''; buyAmountInput.value = '';
            qtyPreview.textContent = '0';
            buyPriceInput.focus();
            saveSimulatorState(); updateSimulatorUI();
        }
    });

    document.getElementById('btnMaxQty').addEventListener('click', () => {
        const stats = getStats();
        if (stats.totalQty > 0) sellQtyInput.value = stats.totalQty;
    });

    document.getElementById('btnReset').addEventListener('click', () => {
        if(confirm('모든 시뮬레이터 내역을 초기화하시겠습니까?')) {
            holdings = []; sellHistory = []; idSeq = 1;
            saveSimulatorState(); updateSimulatorUI();
        }
    });

    sellForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const sellPrice = parseFloat(sellPriceInput.value);
        let remQty = parseInt(sellQtyInput.value, 10);
        const feeRate = parseFloat(feeRateInput.value) || 0;
        
        const stats = getStats();
        if (remQty > stats.totalQty) { alert(`보유 수량(${stats.totalQty}주) 초과`); return; }
        
        if (sellPrice > 0 && remQty > 0) {
            let totalProfit = 0; let totalCost = 0;
            const originalQty = remQty;
            const revenuePerShare = sellPrice * (1 - (feeRate / 100));
            
            const holdingsSnapshot = JSON.parse(JSON.stringify(holdings));
            
            // 1. Designated batch
            if (selectedSellBatchId) {
                const bIdx = holdings.findIndex(h => h.id === selectedSellBatchId);
                if (bIdx !== -1 && holdings[bIdx].qty > 0) {
                    const h = holdings[bIdx];
                    const qtyToSell = Math.min(h.qty, remQty);
                    
                    const costPerShare = h.actualCost / h.initialQty;
                    const cost = qtyToSell * costPerShare;
                    const revenue = qtyToSell * revenuePerShare;
                    const p = revenue - cost;

                    totalCost += cost; totalProfit += p;
                    remQty -= qtyToSell; h.qty -= qtyToSell;
                }
                selectedSellBatchId = null;
            }

            // 2. Multi-batch (LIFO: Start from end)
            for (let i = holdings.length - 1; i >= 0; i--) {
                if (remQty <= 0) break;
                if (holdings[i].qty <= 0) continue;

                const h = holdings[i];
                const qtyToSell = Math.min(h.qty, remQty);
                
                const costPerShare = h.actualCost / h.initialQty;
                const cost = qtyToSell * costPerShare;
                const revenue = qtyToSell * revenuePerShare;
                const p = revenue - cost;

                totalCost += cost; totalProfit += p;
                remQty -= qtyToSell; h.qty -= qtyToSell;
            }

            holdings = holdings.filter(h => h.qty > 0);
            
            let yp = totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(2) : 0;
            sellHistory.push({
                id: sellHistory.length + 1,
                sellPrice, qty: originalQty, profit: totalProfit, yieldPct: yp,
                revenue: totalProfit + totalCost, cost: totalCost,
                holdingsSnapshot
            });

            sellPriceInput.value = ''; sellQtyInput.value = '';
            saveSimulatorState(); updateSimulatorUI();
        }
    });

    function getStats() {
        let totalQty = 0; let totalInvest = 0;
        holdings.forEach(h => {
            totalQty += h.qty;
            const costPerShare = h.actualCost / h.initialQty;
            totalInvest += (costPerShare * h.qty); // Active investment including proportionate fees
        });
        const avgPrice = totalQty > 0 ? Math.round(totalInvest / totalQty) : 0;
        return { totalQty, totalInvest, avgPrice };
    }

    function updateSimulatorUI() {
        const stats = getStats();
        topTotalQtyEl.innerHTML = `${stats.totalQty.toLocaleString()}<small>주</small>`;
        topTotalInvestEl.innerHTML = `${Math.round(stats.totalInvest).toLocaleString()}<small>원</small>`;
        
        // Compute raw avg price without fee for informational display
        let rawInvest = 0;
        holdings.forEach(h => { rawInvest += (h.price * h.qty); });
        const rawAvg = stats.totalQty > 0 ? Math.round(rawInvest / stats.totalQty) : 0;
        topAvgPriceEl.innerHTML = `${rawAvg.toLocaleString()}<small>원</small>`;

        const trProfit = sellHistory.reduce((s, h) => s + h.profit, 0);
        const sign = trProfit > 0 ? '+' : '';
        totalRealizedProfitEl.innerHTML = `${sign}${Math.round(trProfit).toLocaleString()}<small>원</small>`;
        totalRealizedProfitEl.className = `dash-value ${trProfit > 0 ? 'text-profit' : (trProfit < 0 ? 'text-loss' : 'text-neutral')}`;

        let totalRev = 0; let totalHistCost = 0;
        sellHistory.forEach(s => {
            if(s.revenue !== undefined && s.cost !== undefined) {
                totalRev += s.revenue; totalHistCost += s.cost;
            } else {
                let rev = s.qty * s.sellPrice;
                totalRev += rev; totalHistCost += (rev - s.profit);
            }
        });
        
        let overallYield = totalHistCost > 0 ? ((trProfit / totalHistCost) * 100).toFixed(2) : 0;
        
        const historyTotalSellEl = document.getElementById('historyTotalSell');
        const historyTotalYieldEl = document.getElementById('historyTotalYield');
        
        if(historyTotalSellEl) historyTotalSellEl.innerHTML = `${Math.round(totalRev).toLocaleString()}<small>원</small>`;
        if(historyTotalYieldEl) {
            const ySign = trProfit > 0 ? '+' : '';
            const yCls = trProfit > 0 ? 'text-profit' : (trProfit < 0 ? 'text-loss' : 'text-neutral');
            historyTotalYieldEl.innerHTML = `${ySign}${overallYield}<small>%</small>`;
            historyTotalYieldEl.className = `dash-value ${yCls}`;
        }

        // Holdings Table
        holdingsBody.innerHTML = '';
        if (holdings.length === 0) {
            holdingsBody.innerHTML = '<tr class="empty-row"><td colspan="5">매수 내역이 없습니다.</td></tr>';
        } else {
            holdings.forEach((h, i) => {
                const tr = document.createElement('tr');
                if (i === 0) tr.classList.add('first-batch');
                
                const badgeClass = i === 0 ? 'batch-badge first-badge' : 'batch-badge';
                const badgeText = i === 0 ? '1차 (최초)' : `${h.batch}차`;
                const targetPrice = Math.ceil(h.price * 1.05);
                const costPerShare = h.actualCost / h.initialQty;
                const dynamicInvest = Math.round(costPerShare * h.qty);

                tr.innerHTML = `
                    <td><span class="${badgeClass}">${badgeText}</span></td>
                    <td>
                        <div style="font-weight:600; color:var(--text-main);">${h.price.toLocaleString()}원</div>
                        <div style="color:var(--text-muted); font-size:0.85rem;">${h.qty.toLocaleString()}주 (잔여)</div>
                    </td>
                    <td>${dynamicInvest.toLocaleString()}원</td>
                    <td><span class="target-price">${targetPrice.toLocaleString()}원</span></td>
                    <td>
                        <button type="button" class="btn-outline btn-sm sell-fill-btn" data-id="${h.id}" data-price="${targetPrice}" data-qty="${h.qty}">매도 입력</button>
                    </td>
                `;
                holdingsBody.appendChild(tr);
            });
            document.querySelectorAll('.sell-fill-btn').forEach(b => {
                b.addEventListener('click', (e) => {
                    sellPriceInput.value = '';
                    sellQtyInput.value = e.target.dataset.qty;
                    selectedSellBatchId = parseInt(e.target.dataset.id);
                    sellPriceInput.focus();
                });
            });
        }

        // Drop Suggestion & Automatic Buy Amount
        if (holdings.length > 0) {
            const firstBatch = holdings[0];
            if (!buyAmountInput.value) {
                buyAmountInput.value = firstBatch.originalAmount || Math.round(firstBatch.actualCost);
            }
            
            const last = holdings[holdings.length - 1];
            const targetP = Math.floor(last.price * 0.95);
            // Amount of roughly previous chunk
            const targetA = last.price * last.initialQty; 
            dropPriceSpan.textContent = targetP.toLocaleString();
            dropAmountSpan.textContent = targetA.toLocaleString();
            btnDropBuy.dataset.price = targetP;
            btnDropBuy.dataset.amount = targetA;
            dropSuggestion.classList.remove('hidden');
        } else {
            dropSuggestion.classList.add('hidden');
        }

        // History Table
        historyBody.innerHTML = '';
        if (sellHistory.length === 0) {
            historyBody.innerHTML = '<tr class="empty-row"><td colspan="5">매도 내역이 없습니다.</td></tr>';
        } else {
            [...sellHistory].reverse().forEach((s, index) => {
                const tr = document.createElement('tr');
                const pft = Math.round(s.profit);
                const c = pft > 0 ? 'text-profit' : (pft < 0 ? 'text-loss' : 'text-neutral');
                const sg = pft > 0 ? '+' : '';
                
                const isLast = (index === 0);
                const undoHtml = isLast ? `<button type="button" class="btn-text btn-undo-sell" style="margin-left:8px; color:var(--loss); text-decoration:underline;">삭제(되돌리기)</button>` : '';

                tr.innerHTML = `
                    <td>#${s.id}</td>
                    <td>${s.sellPrice.toLocaleString()}원</td>
                    <td>${s.qty.toLocaleString()}주</td>
                    <td class="${c}">${sg}${pft.toLocaleString()}원</td>
                    <td class="${c}">${sg}${s.yieldPct}% ${undoHtml}</td>
                `;
                historyBody.appendChild(tr);
            });
            
            const undoBtn = document.querySelector('.btn-undo-sell');
            if(undoBtn) {
                undoBtn.addEventListener('click', () => {
                    const lastSell = sellHistory.pop();
                    holdings = lastSell.holdingsSnapshot;
                    saveSimulatorState();
                    updateSimulatorUI();
                });
            }
        }
        calculateCurrentReturn();
    }

    function calculateCurrentReturn() {
        const stats = getStats();
        const cp = parseFloat(currentPriceInput.value);
        const feeRate = parseFloat(feeRateInput.value) || 0;
        
        if (!cp || isNaN(cp) || stats.totalQty === 0) {
            returnRateSpan.textContent = '0.00%';
            returnAmountSpan.textContent = '0원';
            returnRateSpan.className = 'return-rate text-neutral';
            returnAmountSpan.className = 'return-amount text-neutral';
            return;
        }

        const rawRevenue = cp * stats.totalQty;
        const netRevenue = rawRevenue * (1 - (feeRate / 100)); // Account for sell fee
        const pnl = netRevenue - stats.totalInvest;
        const yPct = (pnl / stats.totalInvest) * 100;

        const sign = pnl > 0 ? '+' : '';
        returnRateSpan.textContent = `${sign}${yPct.toFixed(2)}%`;
        returnAmountSpan.textContent = `${sign}${Math.round(pnl).toLocaleString()}원`;

        const cls = pnl >= 0 ? 'text-profit' : 'text-loss';
        returnRateSpan.className = `return-rate ${cls}`;
        returnAmountSpan.className = `return-amount ${cls}`;
    }

    // Suggestion Click
    btnDropBuy.addEventListener('click', () => {
        const lp = btnDropBuy.dataset.price;
        const la = btnDropBuy.dataset.amount;
        if (lp && la) {
            buyPriceInput.value = lp;
            buyAmountInput.value = la;
            calculatePreview();
            buyPriceInput.focus();
        }
    });

    // --- Screenshot Logic ---
    const btnScreenshot = document.getElementById('btnScreenshot');
    const screenshotModal = document.getElementById('screenshotModal');
    const captureTarget = document.getElementById('captureTarget');
    const screenshotContainer = document.getElementById('screenshotContainer');
    const btnDownloadShot = document.getElementById('btnDownloadShot');

    document.querySelectorAll('.shot-close').forEach(btn => {
        btn.addEventListener('click', () => screenshotModal.classList.remove('show'));
    });

    btnScreenshot.addEventListener('click', () => {
        // Remove padding/margins temporarily if needed for aesthetics, else html2canvas captures raw
        html2canvas(captureTarget, {
            backgroundColor: '#0f172a',
            scale: 2
        }).then(canvas => {
            screenshotContainer.innerHTML = '';
            screenshotContainer.appendChild(canvas);
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            const imgData = canvas.toDataURL('image/png');
            btnDownloadShot.href = imgData;
            btnDownloadShot.download = 'gridcalc_profit.png';
            screenshotModal.classList.add('show');
        });
    });

    // --- Profit Feed Logic ---
    const btnSubmitPost = document.getElementById('btnSubmitPost');
    const postContent = document.getElementById('postContent');
    const postImage = document.getElementById('postImage');
    const postImageName = document.getElementById('postImageName');
    
    postImage.addEventListener('change', () => {
        if(postImage.files.length > 0) {
            postImageName.textContent = postImage.files[0].name;
        } else {
            postImageName.textContent = '';
        }
    });

    btnSubmitPost.addEventListener('click', () => {
        if (!currentUser) { alert('로그인이 필요합니다.'); return; }
        const text = postContent.value.trim();
        if (!text && postImage.files.length === 0) return;

        let imgDataUrl = null;
        if (postImage.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imgDataUrl = e.target.result;
                addProfitPost(text, imgDataUrl);
            };
            reader.readAsDataURL(postImage.files[0]);
        } else {
            addProfitPost(text, null);
        }
    });

    async function addProfitPost(text, imgData) {
        if (!currentUserId) return;

        const newPost = {
            user_id: currentUserId,
            username: currentUser,
            content: text,
            image_url: imgData, // 실제 구현 시 Supabase Storage 업로드 로직 추가 권장
            likes_count: 0,
            created_at: new Date()
        };

        const { data, error } = await supabaseClient
            .from('posts')
            .insert([newPost])
            .select();

        if (error) {
            alert('인증글 저장 실패: ' + error.message);
        } else {
            postContent.value = ''; postImage.value = ''; postImageName.textContent = '';
            await fetchPosts(); // 다시 불러오기
            renderMyPage();
        }
    }

    async function fetchPosts() {
        // 글과 댓글을 한 번에 가져오기 (관계형 쿼리)
        const { data, error } = await supabaseClient
            .from('posts')
            .select('*, comments(*)')
            .order('created_at', { ascending: false });

        if (data) {
            profitPosts = data.map(p => ({
                id: p.id,
                user_id: p.user_id,
                user: p.username,
                text: p.content,
                img: p.image_url,
                date: new Date(p.created_at).toLocaleString(),
                likes: p.likes_count || 0,
                likedBy: p.liked_by || [], 
                comments: (p.comments || []).sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).map(c => ({
                    id: c.id,
                    user: c.username,
                    user_id: c.user_id,
                    text: c.text
                }))
            }));
            renderProfitFeed();
            renderHotFeed();
            if (document.getElementById('view-mypage').classList.contains('active')) renderMyPage();
        }
    }

    async function fetchBlogPosts() {
        // blog_posts 테이블이 있다고 가정 (SQL 계획서 포함)
        const { data, error } = await supabaseClient
            .from('blog_posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) {
            blogPosts = data.map(b => ({
                id: b.id,
                title: b.title,
                content: b.content,
                img: b.image_url,
                date: new Date(b.created_at).toLocaleDateString()
            }));
            renderBlogFeed();
        }
    }

    function renderProfitFeed() {
        const list = document.getElementById('profitFeedList');
        list.innerHTML = '';
        if (profitPosts.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted)">아직 인증 글이 없습니다. 첫 글을 작성해보세요!</div>';
            return;
        }

        profitPosts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'post-card';
            card.id = `profitFeed-post-${post.id}`;

            let imgHtml = post.img ? `<img src="${post.img}" class="post-img" alt="인증샷">` : '';
            
            let hasLiked = currentUser && post.likedBy.includes(currentUser);
            let likeIcon = '❤️';
            
            let commentsHtml = ``;
            post.comments.forEach(c => {
                const isOwnComment = currentUserId && c.user_id === currentUserId;
                const delBtn = isOwnComment ? `<button class="btn-del-comment" data-id="${c.id}" style="background:none; border:none; color:var(--loss); cursor:pointer; font-size:0.75rem; padding:0 4px;">&times;</button>` : '';
                
                commentsHtml += `<div class="comment-item" style="justify-content:space-between; display:flex; align-items:center;">
                    <div>
                        <span class="comment-author">${c.user}</span>
                        <span class="comment-text">${c.text}</span>
                    </div>
                    ${delBtn}
                </div>`;
            });

            card.innerHTML = `
                <div class="post-header">
                    <div class="post-user">
                        <div class="post-avatar">${post.user.charAt(0).toUpperCase()}</div>
                        ${post.user}
                    </div>
                    <div class="post-date">${post.date}</div>
                </div>
                <div class="post-body">${post.text.replace(/\n/g, '<br>')}</div>
                ${imgHtml}
                <div class="post-actions" style="margin-top:0.5rem; margin-bottom:1rem;">
                    <button class="btn-text btn-like ${hasLiked ? 'liked' : ''}" data-id="${post.id}" style="font-size:1.1rem; border:1px solid ${hasLiked ? 'var(--loss)' : 'var(--glass-border)'}; padding:0.2rem 0.6rem; border-radius:4px; background:${hasLiked ? 'rgba(239,68,68,0.1)' : 'transparent'}; color:${hasLiked ? 'var(--loss)' : 'var(--text-muted)'}; font-weight:bold;">
                        ${likeIcon} <span style="font-size:0.95rem;">${post.likes}</span>
                    </button>
                </div>
                <div class="post-footer">
                    <div class="comments-list" id="comments-${post.id}">
                        ${commentsHtml ? commentsHtml : '<div style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0;">첫 댓글을 남겨보세요!</div>'}
                    </div>
                    <div class="comment-input-area">
                        <input type="text" class="comment-input" placeholder="댓글 달기..." id="cmdInput-${post.id}">
                        <button class="btn-sm btn-outline btn-add-comment" data-id="${post.id}">등록</button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

        document.querySelectorAll('.btn-like').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                if (!currentUser) { alert('로그인이 필요합니다.'); return; }
                
                const post = profitPosts.find(p => p.id === id);
                if (!post) return;

                let newLikedBy = [...post.likedBy];
                let newLikesCount = post.likes;

                if (newLikedBy.includes(currentUser)) {
                    newLikedBy = newLikedBy.filter(u => u !== currentUser);
                    newLikesCount = Math.max(0, newLikesCount - 1);
                } else {
                    newLikedBy.push(currentUser);
                    newLikesCount++;
                }

                try {
                    const { error } = await supabaseClient
                        .from('posts')
                        .update({ likes_count: newLikesCount, liked_by: newLikedBy })
                        .eq('id', id);
                    if (error) throw error;
                    await fetchPosts();
                } catch(err) {
                    alert('좋아요 처리 실패: ' + err.message);
                }
            });
        });

        document.querySelectorAll('.btn-add-comment').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.dataset.id);
                const input = document.getElementById(`cmdInput-${id}`);
                const cText = input.value.trim();
                
                if(!currentUser) { alert('로그인이 필요합니다.'); return; }
                if(!cText) return;

                try {
                    const { error } = await supabaseClient
                        .from('comments')
                        .insert([{
                            post_id: id,
                            user_id: currentUserId,
                            username: currentUser,
                            text: cText
                        }]);
                    if (error) throw error;
                    input.value = '';
                    await fetchPosts();
                    checkNotifications();
                } catch(err) {
                    alert('댓글 저장 실패: ' + err.message);
                }
            });
        });

        // 댓글 삭제 이벤트 리스너 추가
        document.querySelectorAll('.btn-del-comment').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                if (!confirm('댓글을 삭제하시겠습니까?')) return;
                
                try {
                    const { error } = await supabaseClient
                        .from('comments')
                        .delete()
                        .eq('id', id)
                        .eq('user_id', currentUserId);
                    if (error) throw error;
                    await fetchPosts();
                } catch(err) {
                    alert('댓글 삭제 실패: ' + err.message);
                }
            });
        });
    }

    function renderHotFeed() {
        const list = document.getElementById('hotPostsList');
        if (!list) return;
        
        list.innerHTML = '';
        
        const oneDayMs = 24 * 60 * 60 * 1000;
        const now = Date.now();
        
        // Filter: has likes >= 1
        let hotPosts = profitPosts.filter(p => {
            return p.likes >= 1;
        });
        
        // Sort by likes desc
        hotPosts.sort((a, b) => b.likes - a.likes);
        
        // Limit to 3
        hotPosts = hotPosts.slice(0, 3);
        
        if (hotPosts.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:1rem 0;">최근 24시간 내에 반응이 뜨거운 게시물이 없습니다.</div>';
            return;
        }
        
        
        hotPosts.forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'post-card';
            card.style.background = 'rgba(255,255,255,0.03)';
            card.style.border = '1px solid var(--primary)';
            card.style.marginBottom = '1rem';
            card.style.cursor = 'pointer';
            
            let hasLiked = currentUser && post.likedBy && post.likedBy.includes(currentUser);
            let likeIcon = '❤️';
            let imgHtml = post.img ? `<img src="${post.img}" class="post-img" style="max-height:100px; object-fit:cover;" alt="인증샷">` : '';
            
            card.innerHTML = `
                <div class="flex-align" style="margin-bottom:0.5rem;">
                    <span style="font-size:1.5rem; margin-right:0.5rem;">${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                    <span style="font-weight:700; color:var(--text-main);">${post.user}님의 메세지</span>
                </div>
                <div class="post-body" style="font-size:0.9rem; margin-bottom:0.5rem; color:var(--text-main);">${post.text.replace(/\n/g, '<br>')}</div>
                ${imgHtml}
                <div class="flex-align" style="margin-top:0.5rem;">
                    <span style="color:var(--loss); font-weight:700; font-size:1rem; border:1px solid var(--loss); padding:0.1rem 0.5rem; border-radius:4px; background:rgba(239,68,68,0.05);">
                        ${likeIcon} ${post.likes}
                    </span>
                </div>
            `;
            card.addEventListener('click', () => openPostDetail(post.id));
            list.appendChild(card);
        });
    }

    // --- Post Detail Modal Logic ---
    const postDetailModal = document.getElementById('postDetailModal');
    const postDetailContent = document.getElementById('postDetailContent');

    document.querySelectorAll('.detail-close').forEach(btn => {
        btn.addEventListener('click', () => postDetailModal.classList.remove('show'));
    });

    function openPostDetail(id) {
        const post = profitPosts.find(p => p.id === id);
        if(!post) return;
        
        let hasLiked = currentUser && post.likedBy.includes(currentUser);
        let likeIcon = '❤️';
        
        let imgHtml = post.img ? `<img src="${post.img}" class="post-img" style="max-height: 400px; object-fit: contain;" alt="인증샷">` : '';
        
        let commentsHtml = ``;
        post.comments.forEach(c => {
            const isOwnComment = currentUserId && c.user_id === currentUserId;
            const delBtn = isOwnComment ? `<button class="btn-del-modal-comment" data-id="${c.id}" style="background:none; border:none; color:var(--loss); cursor:pointer; font-size:0.75rem; padding:0 4px;">&times;</button>` : '';
            
            commentsHtml += `<div class="comment-item" style="justify-content:space-between; display:flex; align-items:center; margin-bottom:4px;">
                <div>
                    <span class="comment-author">${c.user}</span>
                    <span class="comment-text">${c.text}</span>
                </div>
                ${delBtn}
            </div>`;
        });

        postDetailContent.innerHTML = `
            <div class="post-header">
                <div class="post-user">
                    <div class="post-avatar">${post.user.charAt(0).toUpperCase()}</div>
                    ${post.user}
                </div>
                <div class="post-date">${post.date}</div>
            </div>
            <div class="post-body" style="font-size: 1.1rem; margin-bottom: 1rem;">${post.text.replace(/\n/g, '<br>')}</div>
            ${imgHtml}
            <div class="post-actions" style="margin-top:0.5rem; margin-bottom:1rem;">
                <button class="btn-text btn-modal-like" data-id="${post.id}" style="font-size:1.1rem; border:1px solid var(--loss); padding:0.2rem 0.6rem; border-radius:4px; background:rgba(239,68,68,0.05); color:var(--loss); font-weight:bold;">
                    ${likeIcon} <span style="font-size:0.95rem;">${post.likes}</span>
                </button>
            </div>
            <hr style="border-top:1px solid var(--glass-border); margin-bottom:1rem;">
            <div class="post-footer">
                <div class="comments-list" id="modal-comments-${post.id}">
                    ${commentsHtml}
                </div>
                <div class="comment-input-area" style="margin-top:1rem;">
                    <input type="text" class="comment-input" placeholder="댓글 달기..." id="modalCmdInput-${post.id}">
                    <button class="btn-sm btn-outline btn-modal-comment" data-id="${post.id}">등록</button>
                </div>
            </div>
        `;
        
        postDetailContent.querySelector('.btn-modal-like').addEventListener('click', async () => {
            if (!currentUser) { alert('로그인이 필요합니다.'); return; }
            
            let newLikedBy = [...post.likedBy];
            let newLikesCount = post.likes;

            if (newLikedBy.includes(currentUser)) {
                newLikedBy = newLikedBy.filter(u => u !== currentUser);
                newLikesCount = Math.max(0, newLikesCount - 1);
            } else {
                newLikedBy.push(currentUser);
                newLikesCount++;
            }

            try {
                const { error } = await supabaseClient
                    .from('posts')
                    .update({ likes_count: newLikesCount, liked_by: newLikedBy })
                    .eq('id', id);
                if (error) throw error;
                await fetchPosts();
                openPostDetail(id); // Re-open with new data
            } catch(err) {
                alert('좋아요 처리 실패: ' + err.message);
            }
        });
        
        postDetailContent.querySelector('.btn-modal-comment').addEventListener('click', async () => {
            const input = document.getElementById(`modalCmdInput-${id}`);
            const cText = input.value.trim();
            if(!currentUser) { alert('로그인이 필요합니다.'); return; }
            if(!cText) return;

            try {
                const { error } = await supabaseClient
                    .from('comments')
                    .insert([{
                        post_id: id,
                        user_id: currentUserId,
                        username: currentUser,
                        text: cText
                    }]);
                if (error) throw error;
                input.value = '';
                await fetchPosts();
                checkNotifications();
                openPostDetail(id);
            } catch(err) {
                alert('댓글 저장 실패: ' + err.message);
            }
        });

        // 모달 내 댓글 삭제
        postDetailContent.querySelectorAll('.btn-del-modal-comment').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const commentId = parseInt(e.currentTarget.dataset.id);
                if (!confirm('댓글을 삭제하시겠습니까?')) return;
                
                try {
                    const { error } = await supabaseClient
                        .from('comments')
                        .delete()
                        .eq('id', commentId)
                        .eq('user_id', currentUserId);
                    if (error) throw error;
                    await fetchPosts();
                    openPostDetail(id); // 모달 다시 그리기
                } catch(err) {
                    alert('댓글 삭제 실패: ' + err.message);
                }
            });
        });
        
        postDetailModal.classList.add('show');
    }

    // --- My Page Logic ---
    function renderMyPage() {
        const list = document.getElementById('myPostsList');
        if(!list) return;
        list.innerHTML = '';

        if(!currentUser) {
            list.innerHTML = '<div style="color:var(--text-muted); text-align:center;">로그인 후 이용 가능합니다.</div>';
            return;
        }

        const myPosts = profitPosts.filter(p => p.user === currentUser);
        if(myPosts.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted); text-align:center;">아직 작성한 글이 없습니다.</div>';
            return;
        }

        myPosts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'post-card';
            
            const seen = lastSeenComments[post.id] || 0;
            const hasNewComments = post.comments.length > seen;
            const newBadgeHtml = hasNewComments ? `<span style="background:var(--loss); color:white; font-size:0.75rem; padding:0.2rem 0.5rem; border-radius:12px; margin-left:0.5rem; font-weight:bold;">새 댓글 ${post.comments.length - seen}</span>` : '';
            
            let imgHtml = post.img ? `<img src="${post.img}" class="post-img" style="max-height:200px; object-fit:contain;" alt="인증샷">` : '';
            
            let commentsHtml = ``;
            post.comments.forEach((c, idx) => {
                const isNewCmd = (idx >= seen) && hasNewComments;
                const newCmdBadge = isNewCmd ? `<span style="color:var(--loss); font-size:0.75rem; margin-left:0.4rem; font-weight:bold;">N</span>` : '';
                commentsHtml += `<div class="comment-item">
                    <span class="comment-author">${c.user}</span>
                    <span class="comment-text">${c.text}</span>
                    ${newCmdBadge}
                </div>`;
            });
            
            card.innerHTML = `
                <div class="space-between" style="border-bottom:1px solid var(--glass-border); padding-bottom:1rem; margin-bottom:1rem;">
                    <div class="flex-align">
                        <span style="color:var(--text-muted); font-size:0.9rem;">${post.date}</span>
                        ${newBadgeHtml}
                    </div>
                    <div>
                        <button class="btn-sm btn-edit-post" data-id="${post.id}" style="border:1px solid var(--primary); color:var(--primary); margin-right:0.5rem;">내용수정</button>
                        <button class="btn-sm btn-del-post" data-id="${post.id}" style="border:1px solid var(--loss); color:var(--loss);">삭제</button>
                    </div>
                </div>
                <div class="post-body" style="font-size:1rem;color:var(--text-main); margin-bottom:1rem;">${post.text.replace(/\n/g, '<br>')}</div>
                ${imgHtml}
                <div style="margin-top:1rem; margin-bottom:0.5rem;">
                    <span style="color:var(--loss); font-weight:700; font-size:1rem; border:1px solid var(--loss); padding:0.1rem 0.5rem; border-radius:4px; background:rgba(239,68,68,0.05);">
                        ❤️ ${post.likes || 0}
                    </span>
                </div>
                <div class="post-footer" style="margin-top:1rem; border-top:1px solid var(--glass-border); padding-top:1rem;">
                    <div class="comments-list">
                        ${commentsHtml ? commentsHtml : '<div style="color:var(--text-muted); font-size:0.9rem; text-align:center;">아직 댓글이 없습니다.</div>'}
                    </div>
                </div>
            `;
            
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                if(e.target.classList.contains('btn-edit-post') || e.target.classList.contains('btn-del-post')) return;
                
                // Switch view to profit
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                const profitBtn = document.querySelector('[data-target="view-profit"]');
                if (profitBtn) profitBtn.classList.add('active');
                
                document.querySelectorAll('.view-section').forEach(v => {
                    v.classList.remove('active');
                    v.classList.add('hidden');
                });
                document.getElementById('view-profit').classList.remove('hidden');
                document.getElementById('view-profit').classList.add('active');
                
                // Scroll specifically to this post inside profit feed
                setTimeout(() => {
                    const targetEl = document.getElementById(`profitFeed-post-${post.id}`);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const originalBg = targetEl.style.background;
                        targetEl.style.transition = 'background 0.5s';
                        targetEl.style.background = 'rgba(79, 70, 229, 0.1)';
                        setTimeout(() => targetEl.style.background = originalBg, 1500);
                    }
                }, 100);
            });
            
            list.appendChild(card);
        });

        document.querySelectorAll('.btn-del-post').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if(confirm('이 글을 삭제하시겠습니까?')) {
                    const { error } = await supabaseClient
                        .from('posts')
                        .delete()
                        .match({ id: id, user_id: currentUserId });

                    if (error) {
                        alert('삭제 실패: ' + error.message);
                    } else {
                        profitPosts = profitPosts.filter(p => p.id !== id);
                        renderProfitFeed();
                        renderHotFeed();
                        renderMyPage();
                    }
                }
            });
        });

        document.querySelectorAll('.btn-edit-post').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const post = profitPosts.find(p => p.id === id);
                if(!post) return;
                const newText = prompt('새로운 내용을 입력하세요:', post.text);
                if(newText !== null) {
                    const { error } = await supabaseClient
                        .from('posts')
                        .update({ content: newText })
                        .match({ id: id, user_id: currentUserId });

                    if (error) {
                        alert('수정 실패: ' + error.message);
                    } else {
                        post.text = newText;
                        renderProfitFeed();
                        renderHotFeed();
                        renderMyPage();
                    }
                }
            });
        });
    }

    // --- Blog Logic ---
    const btnSubmitBlog = document.getElementById('btnSubmitBlog');
    const blogTitle = document.getElementById('blogTitle');
    const blogContent = document.getElementById('blogContent');
    const blogImageInput = document.getElementById('blogImageInput');

    if (blogImageInput) {
        blogImageInput.addEventListener('change', () => {
            if (blogImageInput.files.length > 0) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    blogContent.focus();
                    document.execCommand('insertImage', false, e.target.result);
                    
                    // Add basic responsive styling to inserted images
                    const imgs = blogContent.querySelectorAll('img');
                    imgs.forEach(img => {
                        if (!img.style.maxWidth) {
                            img.style.maxWidth = '100%';
                            img.style.borderRadius = '8px';
                            img.style.display = 'block';
                            img.style.marginTop = '0.5rem';
                            img.style.marginBottom = '0.5rem';
                        }
                    });
                };
                reader.readAsDataURL(blogImageInput.files[0]);
                blogImageInput.value = ''; // Reset input
            }
        });
    }

    function autoLinkTextNodes(node) {
        if (node.nodeType === 3) { // Text node
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            if (urlRegex.test(node.nodeValue)) {
                if (node.parentNode && node.parentNode.tagName === 'A') return;
                
                const span = document.createElement('span');
                span.innerHTML = node.nodeValue.replace(urlRegex, '<a href="$1" target="_blank" style="color:var(--primary); text-decoration:underline;">$1</a>');
                
                while (span.firstChild) {
                    node.parentNode.insertBefore(span.firstChild, node);
                }
                node.parentNode.removeChild(node);
            }
        } else if (node.nodeType === 1) { // Element node
            if (node.tagName !== 'A' && node.tagName !== 'IMG' && node.tagName !== 'BUTTON') {
                const children = Array.from(node.childNodes);
                for (let i = 0; i < children.length; i++) {
                    autoLinkTextNodes(children[i]);
                }
            }
        }
    }

    btnSubmitBlog.addEventListener('click', async () => {
        if (!currentUser || !currentUser.startsWith('admin')) return;
        const title = blogTitle.value.trim();
        const contentHtml = blogContent.innerHTML.trim();
        
        const tempCheck = document.createElement('div');
        tempCheck.innerHTML = contentHtml;
        const pureText = tempCheck.textContent.trim();
        
        if(!title || (!pureText && contentHtml.indexOf('<img') === -1)) return;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentHtml;
        autoLinkTextNodes(tempDiv);
        const processedContent = tempDiv.innerHTML;

        const { error } = await supabaseClient
            .from('blog_posts')
            .insert([{
                title: title,
                content: processedContent,
                author_id: currentUserId,
                created_at: new Date()
            }]);

        if (error) {
            alert('블로그 저장 실패: ' + error.message);
        } else {
            blogTitle.value = ''; blogContent.innerHTML = '';
            await fetchBlogPosts();
        }
    });

    function renderBlogFeed() {
        const list = document.getElementById('blogList');
        if (!list) return;
        list.innerHTML = '';

        if (blogPosts.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted)">아직 등록된 정보 글이 없습니다.</div>';
            return;
        }

        const isAdmin = currentUser && (currentUser === 'admin' || currentUser.startsWith('admin'));

        // 1. 최신 글 (Full Display)
        const latest = blogPosts[0];
        const delBtnLatest = isAdmin ? `<button class="btn-sm btn-del-blog" data-id="${latest.id}" style="float:right; border:1px solid var(--loss); color:var(--loss); background:none; padding:2px 8px; border-radius:4px; font-size:0.8rem; cursor:pointer;">삭제</button>` : '';
        
        const latestCard = document.createElement('div');
        latestCard.className = 'post-card blog-card';
        latestCard.style.borderLeft = '4px solid var(--primary)';
        latestCard.innerHTML = `
            <div style="font-size:0.75rem; color:var(--primary); font-weight:700; margin-bottom:0.5rem;">📌 최신 소식</div>
            <div class="blog-title" style="font-size:1.4rem;">${latest.title} ${delBtnLatest}</div>
            <div class="post-date" style="margin-bottom:1rem;">관리자 | ${latest.date}</div>
            <div class="post-body" style="font-size:1.05rem; overflow-wrap:anywhere;">${latest.content}</div>
        `;
        list.appendChild(latestCard);

        // 2. 이전 글 목록 (최대 5개)
        const others = blogPosts.slice(1, 6);
        if (others.length > 0) {
            const othersContainer = document.createElement('div');
            othersContainer.style.marginTop = '2.5rem';
            othersContainer.innerHTML = `<h3 style="font-size:1.1rem; margin-bottom:1rem; color:var(--mantine-gray-7); border-bottom:2px solid var(--mantine-gray-1); padding-bottom:0.8rem; display:flex; align-items:center;">📜 이전 소식 목록</h3>`;
            
            others.forEach(b => {
                const delBtnOther = isAdmin ? `<button class="btn-del-blog" data-id="${b.id}" style="border:none; color:var(--loss); background:none; cursor:pointer; font-size:1.2rem; padding: 0 10px; line-height:1;">&times;</button>` : '';
                const item = document.createElement('div');
                item.className = 'blog-list-item';
                item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:1.2rem 1rem; background:#fff; border-bottom:1px solid var(--mantine-gray-1); transition:background 0.15s; cursor:pointer;';
                item.innerHTML = `
                    <div style="flex:1;">
                        <span style="font-weight:600; font-size:1rem; color:var(--mantine-gray-8);">${b.title}</span>
                        <span style="font-size:0.8rem; color:var(--mantine-gray-5); margin-left:12px;">${b.date.split(',')[0]}</span>
                    </div>
                    ${delBtnOther}
                `;
                
                // 리스트 아이템 클릭 시 상세보기 모달 오픈
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('btn-del-blog')) return; // 삭제 버튼 클릭 시 무시
                    openBlogDetail(b);
                });

                othersContainer.appendChild(item);
            });
            list.appendChild(othersContainer);
        }

        // 블로그 삭제 이벤트 다시 바인딩 (두 타입 모두 처리)
        document.querySelectorAll('.btn-del-blog').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                if(confirm('이 블로그 글을 삭제하시겠습니까?')) {
                    const { error } = await supabaseClient.from('blog_posts').delete().match({ id: id });
                    if (error) {
                        alert('블로그 삭제 실패: ' + error.message);
                    } else {
                        await fetchBlogPosts();
                    }
                }
            });
        });
    }

    function openBlogDetail(post) {
        const modal = document.getElementById('postDetailModal');
        const content = document.getElementById('postDetailContent');
        if (!modal || !content) return;

        content.innerHTML = `
            <div style="padding:1.5rem; text-align:left;">
                <div style="font-size:0.75rem; color:var(--primary); font-weight:700; margin-bottom:0.5rem;">📜 이전 게시물 상세보기</div>
                <h2 style="font-size:1.6rem; margin-bottom:0.8rem; color:var(--mantine-gray-9); line-height:1.3;">${post.title}</h2>
                <div style="font-size:0.85rem; color:var(--mantine-gray-5); margin-bottom:1.5rem; border-bottom:1px solid var(--mantine-gray-2); padding-bottom:1rem;">
                    관리자 | ${post.date}
                </div>
                <div class="blog-detail-body" style="font-size:1.05rem; line-height:1.8; color:var(--mantine-gray-8); overflow-wrap:anywhere;">
                    ${post.content}
                </div>
            </div>
        `;
        modal.classList.add('show');
    }

    // --- Drag and Drop Logic ---
    function setupDragAndDrop(dropZone, fileInput) {
        if (!dropZone) return;
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.border = '2px dashed var(--primary)';
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.border = ''; // restore
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.border = '';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/') && fileInput) {
                    const dT = new DataTransfer();
                    dT.items.add(file);
                    fileInput.files = dT.files;
                    fileInput.dispatchEvent(new Event('change'));
                }
            }
        });
    }

    setupDragAndDrop(document.getElementById('postContent'), postImage);
    setupDragAndDrop(document.getElementById('blogContent'), blogImageInput);

});
