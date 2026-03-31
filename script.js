
(() => {

  
  const STORAGE      = sessionStorage;          
  const SESSION_KEY  = 'luxecalc_session_paid';
  const PROCESS_MS   = 5000;                     

  /* ── State ── */
  let current       = '0';
  let previous      = '';
  let operator      = null;
  let freshResult   = false;
  let pendingResult = null;

  /* ── DOM ── */
  const display    = document.getElementById('display');
  const expression = document.getElementById('expression');
  const overlay    = document.getElementById('modalOverlay');
  const unlockBtn  = document.getElementById('unlockBtn');
  const planCards  = document.querySelectorAll('.plan-card');

  /* ── Number formatting ── */
  const fmt = n => {
    const num = parseFloat(n);
    if (isNaN(num))      return n;
    if (!isFinite(num))  return 'Error';
    const s   = parseFloat(num.toPrecision(10)).toString();
    const [int, dec] = s.split('.');
    const formatted   = parseInt(int, 10).toLocaleString('en-US');
    return dec ? `${formatted}.${dec}` : formatted;
  };

  /* ── Display update ── */
  const setDisplay = val => {
    display.textContent = fmt(String(val));
    display.classList.remove('pop');
    void display.offsetWidth;
    display.classList.add('pop');
  };

  const updateExpression = () => {
    expression.textContent = (previous && operator)
      ? `${fmt(previous)} ${operator}`
      : '';
  };

  const calculate = (a, b, op) => {
    const x = parseFloat(a), y = parseFloat(b);
    switch (op) {
      case '+': return x + y;
      case '−': return x - y;
      case '×': return x * y;
      case '÷': return y === 0 ? 'Error' : x / y;
      default:  return b;
    }
  };

  const handleNumber = val => {
    if (freshResult) { current = val; freshResult = false; }
    else current = current === '0' ? val : current + val;
    if (current.replace('-', '').replace('.', '').length > 12) return;
    setDisplay(current);
  };

  const handleOperator = op => {
    if (previous && operator && !freshResult) {
      const res = calculate(previous, current, operator);
      previous  = String(res === 'Error' ? 0 : res);
      setDisplay(previous);
      current   = previous;
    } else {
      previous = current;
    }
    operator    = op;
    freshResult = true;
    updateExpression();
    highlightOp(op);
  };

  const handleEquals = () => {
    if (!operator || !previous) return;

    const a  = previous;
    const b  = current;
    const op = operator;
    const res = calculate(a, b, op);

    expression.textContent = `${fmt(a)} ${op} ${fmt(b)} =`;
    const result = res === 'Error' ? 'Error' : String(res);

    operator    = null;
    previous    = '';
    freshResult = true;
    clearOpHighlight();

    
    if (STORAGE.getItem(SESSION_KEY)) {
      finishResult(result);
    } else {
      pendingResult = result;
      showModal();
    }
  };

  const finishResult = val => {
    current = val;
    setDisplay(val);
  };

  const handleClear = () => {
    current = '0'; previous = ''; operator = null; freshResult = false;
    setDisplay('0');
    expression.textContent = '';
    clearOpHighlight();
  };

  const handleSign = () => {
    if (current === '0' || current === 'Error') return;
    current = String(parseFloat(current) * -1);
    setDisplay(current);
  };

  const handlePercent = () => {
    if (current === 'Error') return;
    current = String(parseFloat(current) / 100);
    setDisplay(current);
  };

  const handleDecimal = () => {
    if (freshResult) { current = '0.'; freshResult = false; }
    else if (!current.includes('.')) current += '.';
    setDisplay(current);
  };

  const highlightOp = op => {
    clearOpHighlight();
    document.querySelectorAll('.btn-op').forEach(b => {
      if (b.dataset.value === op) b.classList.add('active');
    });
  };
  const clearOpHighlight = () =>
    document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active'));

  const ensureRippleStyle = (() => {
    let injected = false;
    return () => {
      if (injected) return;
      const s = document.createElement('style');
      s.textContent = `@keyframes rippleAnim{to{transform:translate(-50%,-50%) scale(2.6);opacity:0}}`;
      document.head.appendChild(s);
      injected = true;
    };
  })();

  const ripple = btn => {
    ensureRippleStyle();
    const r = document.createElement('span');
    r.style.cssText = [
      'position:absolute',
      'border-radius:50%',
      'background:rgba(255,255,255,0.16)',
      'width:60px',
      'height:60px',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%) scale(0)',
      'animation:rippleAnim 0.4s ease-out forwards',
      'pointer-events:none',
    ].join(';');
    btn.appendChild(r);
    setTimeout(() => r.remove(), 420);
  };

  document.querySelector('.calc-grid').addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    ripple(btn);
    const { action, value } = btn.dataset;
    switch (action) {
      case 'num':     handleNumber(value);   break;
      case 'op':      handleOperator(value); break;
      case 'equals':  handleEquals();        break;
      case 'clear':   handleClear();         break;
      case 'sign':    handleSign();          break;
      case 'percent': handlePercent();       break;
      case 'decimal': handleDecimal();       break;
    }
  });

  document.addEventListener('keydown', e => {
    if ('0123456789'.includes(e.key))             handleNumber(e.key);
    else if (e.key === '+')                        handleOperator('+');
    else if (e.key === '-')                        handleOperator('−');
    else if (e.key === '*')                        handleOperator('×');
    else if (e.key === '/') { e.preventDefault(); handleOperator('÷'); }
    else if (e.key === 'Enter' || e.key === '=')  handleEquals();
    else if (e.key === 'Escape' || e.key === 'c') handleClear();
    else if (e.key === '.')                        handleDecimal();
    else if (e.key === '%')                        handlePercent();
    else if (e.key === 'Backspace') {
      if (current.length > 1) { current = current.slice(0, -1); setDisplay(current); }
      else { current = '0'; setDisplay('0'); }
    }
  });

  let selectedPlan = null;

  const showModal = () => {
    selectedPlan           = null;
    unlockBtn.disabled     = true;
    unlockBtn.textContent  = 'Select a Plan to Unlock';
    unlockBtn.classList.remove('processing');
    planCards.forEach(c => c.classList.remove('selected'));
    overlay.classList.add('show');
  };

  planCards.forEach(card => {
    card.addEventListener('click', () => {

      if (unlockBtn.classList.contains('processing')) return;

      planCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedPlan          = card.dataset.plan;
      unlockBtn.disabled    = false;
      unlockBtn.textContent = '✦ Unlock My Result';
    });
  });

  unlockBtn.addEventListener('click', () => {
    if (!selectedPlan || unlockBtn.classList.contains('processing')) return;

    /* 1. Enter processing state */
    unlockBtn.disabled    = true;
    unlockBtn.classList.add('processing');
    unlockBtn.textContent = 'Confirming your payment…';
    planCards.forEach(c => c.style.pointerEvents = 'none');

    setTimeout(() => {
      STORAGE.setItem(SESSION_KEY, '1');
      overlay.classList.remove('show');
      unlockBtn.classList.remove('processing');
      planCards.forEach(c => c.style.pointerEvents = '');
      if (pendingResult !== null) {
        finishResult(pendingResult);
        pendingResult = null;
      }
    }, PROCESS_MS);
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay && !unlockBtn.classList.contains('processing')) {
      
    }
  });

})();
