document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let currentUser = localStorage.getItem('gridCalcUser') || null;
    
    // Simulator State
    let holdings = []; 
    let sellHistory = [];
    let idSeq = 1;
    let selectedSellBatchId = null;

    // Social & Blog State
    let profitPosts = JSON.parse(localStorage.getItem('gridCalcProfitPosts') || '[]');
    let blogPosts = JSON.parse(localStorage.getItem('gridCalcBlogPosts') || '[]');
    // User Storage for auth check
    let userList = JSON.parse(localStorage.getItem('gridCalcUsers') || '[]');
    let isSignupMode = false;
    
    // Notifications State
    // Format: { postId: lastSeenCommentCount }
    let lastSeenComments = JSON.parse(localStorage.getItem('gridCalcNoti') || '{}');

    // --- Navigation & Core Elements ---
    const navBtns = document.querySelectorAll('.nav-btn');
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

    // --- Init ---
    updateAuthUI();
    loadSimulatorState();
    updateSimulatorUI();
    renderProfitFeed();
    renderHotFeed();
    renderMyPage();
    renderBlogFeed();
    checkNotifications();

    // --- Auth & Routing ---
    const logoHome = document.getElementById('logoHome');
    logoHome.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        const targetBtn = document.querySelector('[data-target="view-simulator"]');
        if (targetBtn) targetBtn.classList.add('active');
        
        viewSections.forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });
        const simView = document.getElementById('view-simulator');
        simView.classList.remove('hidden');
        simView.classList.add('active');
    });

    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            navBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const targetId = e.target.dataset.target;
            viewSections.forEach(v => {
                v.classList.remove('active');
                v.classList.add('hidden');
            });
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');
        });
    });

    navMyPage.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        
        // Re-render my page first so it can render the "New" badges based on current lastSeenComments
        renderMyPage();

        // Clear notifications
        if (currentUser) {
            const myP = profitPosts.filter(p => p.user === currentUser);
            myP.forEach(p => {
                lastSeenComments[p.id] = p.comments.length;
            });
            localStorage.setItem('gridCalcNoti', JSON.stringify(lastSeenComments));
            checkNotifications();
        }

        viewSections.forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });
        const mpView = document.getElementById('view-mypage');
        mpView.classList.remove('hidden');
        mpView.classList.add('active');
    });

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

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = loginUsername.value.trim();
        const password = loginPassword.value.trim();
        
        if (username && password) {
            if (isSignupMode) {
                if (username === 'admin') { alert('admin은 시스템 예약 계정입니다.'); return; }
                if (userList.find(u => u.username === username)) { alert('이미 존재하는 계정입니다.'); return; }
                userList.push({ username, password });
                localStorage.setItem('gridCalcUsers', JSON.stringify(userList));
                alert('회원가입이 완료되었습니다.');
            } else {
                if (username === 'admin') {
                    if (password !== 'qaazsx1110!') { alert('관리자 비밀번호가 틀렸습니다.'); return; }
                } else {
                    const u = userList.find(u => u.username === username);
                    if (!u) { alert('존재하지 않는 계정입니다. 회원가입을 먼저 진행해주세요.'); return; }
                    if (u.password !== password) { alert('비밀번호가 틀렸습니다.'); return; }
                }
            }
            
            currentUser = username;
            localStorage.setItem('gridCalcUser', currentUser);
            loginModal.classList.remove('show');
            updateAuthUI();
            loadSimulatorState();
            updateSimulatorUI();
            renderProfitFeed();
            renderHotFeed();
            renderMyPage();
            checkNotifications();
        }
    });

    btnLogout.addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('gridCalcUser');
        updateAuthUI();
        loadSimulatorState();
        updateSimulatorUI();
        renderProfitFeed();
        renderHotFeed();
        renderMyPage();
        checkNotifications();
        
        // redirect to intro if in mypage
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
            
            if (currentUser === 'admin') {
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

    // --- Simulator Logic ---
    function loadSimulatorState() {
        const key = currentUser ? `gridCalcState_${currentUser}` : 'gridCalcState_anon';
        const d = localStorage.getItem(key);
        if (d) {
            try {
                const p = JSON.parse(d);
                holdings = p.holdings || [];
                sellHistory = p.sellHistory || [];
                idSeq = p.idSeq || 1;
                if(p.feeRate !== undefined) feeRateInput.value = p.feeRate;
            } catch(e) {}
        } else {
            holdings = []; sellHistory = []; idSeq = 1;
        }
    }

    function saveSimulatorState() {
        const key = currentUser ? `gridCalcState_${currentUser}` : 'gridCalcState_anon';
        localStorage.setItem(key, JSON.stringify({holdings, sellHistory, idSeq, feeRate: feeRateInput.value}));
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

    function addProfitPost(text, imgData) {
        profitPosts.unshift({
            id: Date.now(),
            user: currentUser,
            text: text,
            img: imgData,
            date: new Date().toLocaleString(),
            likes: 0,
            likedBy: [],
            timestamp: Date.now(),
            comments: []
        });
        localStorage.setItem('gridCalcProfitPosts', JSON.stringify(profitPosts));
        postContent.value = ''; postImage.value = ''; postImageName.textContent = '';
        renderProfitFeed();
        renderMyPage();
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

            // Fix older posts missing likes properties
            if (post.likes === undefined) post.likes = 0;
            if (post.likedBy === undefined) post.likedBy = [];

            let imgHtml = post.img ? `<img src="${post.img}" class="post-img" alt="인증샷">` : '';
            
            let hasLiked = currentUser && post.likedBy.includes(currentUser);
            let likeIcon = hasLiked ? '❤️' : '♡';
            
            let commentsHtml = ``;
            post.comments.forEach(c => {
                commentsHtml += `<div class="comment-item">
                    <span class="comment-author">${c.user}</span>
                    <span class="comment-text">${c.text}</span>
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
                    <button class="btn-text btn-like" data-id="${post.id}" style="font-size:1.1rem; border:1px solid var(--loss); padding:0.2rem 0.6rem; border-radius:4px; background:rgba(239,68,68,0.05); color:var(--loss); font-weight:bold;">
                        ${likeIcon} <span style="font-size:0.95rem;">${post.likes}</span>
                    </button>
                </div>
                <div class="post-footer">
                    <div class="comments-list" id="comments-${post.id}">
                        ${commentsHtml}
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
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                if (!currentUser) { alert('로그인이 필요합니다.'); return; }
                
                const idx = profitPosts.findIndex(p => p.id === id);
                if (idx !== -1) {
                    if (profitPosts[idx].likes === undefined) {
                        profitPosts[idx].likes = 0;
                        profitPosts[idx].likedBy = [];
                    }
                    if (profitPosts[idx].likedBy.includes(currentUser)) {
                        profitPosts[idx].likedBy = profitPosts[idx].likedBy.filter(u => u !== currentUser);
                        profitPosts[idx].likes--;
                    } else {
                        profitPosts[idx].likedBy.push(currentUser);
                        profitPosts[idx].likes++;
                    }
                    localStorage.setItem('gridCalcProfitPosts', JSON.stringify(profitPosts));
                    renderProfitFeed();
                    renderHotFeed();
                }
            });
        });

        document.querySelectorAll('.btn-add-comment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                const input = document.getElementById(`cmdInput-${id}`);
                const cText = input.value.trim();
                
                if(!currentUser) { alert('로그인이 필요합니다.'); return; }
                if(cText) {
                    const idx = profitPosts.findIndex(p => p.id === id);
                    if(idx !== -1) {
                        profitPosts[idx].comments.push({ user: currentUser, text: cText });
                        localStorage.setItem('gridCalcProfitPosts', JSON.stringify(profitPosts));
                        renderProfitFeed();
                        checkNotifications();
                    }
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
        
        // Filter: has likes >= 1 AND created within last 24h
        let hotPosts = profitPosts.filter(p => {
            const t = p.timestamp || p.id; // fallback to ID if no timestamp
            return p.likes >= 1 && (now - t) <= oneDayMs;
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
            let likeIcon = hasLiked ? '❤️' : '♡';
            
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
        let likeIcon = hasLiked ? '❤️' : '♡';
        
        let imgHtml = post.img ? `<img src="${post.img}" class="post-img" style="max-height: 400px; object-fit: contain;" alt="인증샷">` : '';
        
        let commentsHtml = ``;
        post.comments.forEach(c => {
            commentsHtml += `<div class="comment-item">
                <span class="comment-author">${c.user}</span>
                <span class="comment-text">${c.text}</span>
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
        
        postDetailContent.querySelector('.btn-modal-like').addEventListener('click', () => {
            if (!currentUser) { alert('로그인이 필요합니다.'); return; }
            if (post.likes === undefined) { post.likes = 0; post.likedBy = []; }
            if (post.likedBy.includes(currentUser)) {
                post.likedBy = post.likedBy.filter(u => u !== currentUser);
                post.likes--;
            } else {
                post.likedBy.push(currentUser);
                post.likes++;
            }
            localStorage.setItem('gridCalcProfitPosts', JSON.stringify(profitPosts));
            renderProfitFeed();
            renderHotFeed();
            openPostDetail(id); // re-render modal
        });
        
        postDetailContent.querySelector('.btn-modal-comment').addEventListener('click', () => {
            const input = document.getElementById(`modalCmdInput-${id}`);
            const cText = input.value.trim();
            if(!currentUser) { alert('로그인이 필요합니다.'); return; }
            if(cText) {
                post.comments.push({ user: currentUser, text: cText });
                localStorage.setItem('gridCalcProfitPosts', JSON.stringify(profitPosts));
                renderProfitFeed();
                renderHotFeed();
                checkNotifications();
                openPostDetail(id); // re-render modal
            }
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
                        ♡ ${post.likes || 0}
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
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                if(confirm('이 글을 삭제하시겠습니까?')) {
                    profitPosts = profitPosts.filter(p => p.id !== id);
                    localStorage.setItem('gridCalcProfitPosts', JSON.stringify(profitPosts));
                    renderProfitFeed();
                    renderHotFeed();
                    renderMyPage();
                }
            });
        });

        document.querySelectorAll('.btn-edit-post').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const post = profitPosts.find(p => p.id === id);
                if(!post) return;
                const newText = prompt('새로운 내용을 입력하세요:', post.text);
                if(newText !== null) {
                    post.text = newText;
                    localStorage.setItem('gridCalcProfitPosts', JSON.stringify(profitPosts));
                    renderProfitFeed();
                    renderHotFeed();
                    renderMyPage();
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

    btnSubmitBlog.addEventListener('click', () => {
        if (currentUser !== 'admin') return;
        const title = blogTitle.value.trim();
        const contentHtml = blogContent.innerHTML.trim();
        
        // ensure not completely empty text or images
        if(!title || (!blogContent.innerText.trim() && contentHtml.indexOf('<img') === -1)) return;

        // Create a temporary div to parse and auto-link text safely
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentHtml;
        autoLinkTextNodes(tempDiv);
        const processedContent = tempDiv.innerHTML;

        blogPosts.unshift({
            id: Date.now(),
            title: title,
            content: processedContent,
            date: new Date().toLocaleString()
        });
        localStorage.setItem('gridCalcBlogPosts', JSON.stringify(blogPosts));
        blogTitle.value = ''; blogContent.innerHTML = '';
        renderBlogFeed();
    });

    function renderBlogFeed() {
        const list = document.getElementById('blogList');
        list.innerHTML = '';
        if (blogPosts.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted)">아직 등록된 정보 글이 없습니다.</div>';
            return;
        }

        blogPosts.forEach(b => {
            const card = document.createElement('div');
            card.className = 'post-card blog-card';
            card.innerHTML = `
                <div class="blog-title">${b.title}</div>
                <div class="post-date" style="margin-bottom:1rem;">관리자 | ${b.date}</div>
                <div class="post-body" style="font-size:1rem; overflow-wrap:anywhere;">${b.content}</div>
            `;
            list.appendChild(card);
        });
    }

});
