/**
 * 쟁의 참여 현황 - 메인 스크립트
 * 외부 JS 파일 (CSP 인라인 스크립트 차단 대응)
 */
(function () {

  let data = [];
  const isFileProtocol = (window.location.protocol === 'file:');

  // HTML 이스케이프
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 테이블 행 추가
  function addRow(item) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    const d = item || { division: '', dept: '', total: '', part: '', note: '' };
    tr.innerHTML =
      '<td><input type="text" value="' + escHtml(d.division) + '" placeholder="사업부명"></td>' +
      '<td><input type="text" value="' + escHtml(d.dept) + '" placeholder="부서명"></td>' +
      '<td><input type="number" value="' + (d.total || '') + '" min="0" placeholder="0"></td>' +
      '<td><input type="number" value="' + (d.part || '') + '" min="0" placeholder="0"></td>' +
      '<td><input type="text" value="' + escHtml(d.note) + '" placeholder="특이사항 입력"></td>' +
      '<td><button class="btn-delete">삭제</button></td>';
    tbody.appendChild(tr);
  }

  // 행 삭제
  function deleteRow(btn) {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
  }

  // 테이블 정렬
  function sortTable(th) {
    const col = parseInt(th.getAttribute('data-col'), 10);
    const type = th.getAttribute('data-type');
    const isAsc = th.classList.contains('asc');

    document.querySelectorAll('thead th.sortable').forEach(function (h) {
      h.classList.remove('asc', 'desc');
    });
    th.classList.add(isAsc ? 'desc' : 'asc');
    const dir = isAsc ? -1 : 1;

    const tbody = document.getElementById('tableBody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort(function (a, b) {
      const aVal = a.querySelectorAll('input')[col].value.trim();
      const bVal = b.querySelectorAll('input')[col].value.trim();
      if (type === 'number') {
        return ((parseInt(aVal, 10) || 0) - (parseInt(bVal, 10) || 0)) * dir;
      }
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });
    rows.forEach(function (r) { tbody.appendChild(r); });
  }

  // 테이블 데이터 가져오기
  function getTableData() {
    const rows = document.querySelectorAll('#tableBody tr');
    const result = [];
    rows.forEach(function (tr) {
      const inputs = tr.querySelectorAll('input');
      result.push({
        division: inputs[0].value.trim(),
        dept: inputs[1].value.trim(),
        total: parseInt(inputs[2].value, 10) || 0,
        part: parseInt(inputs[3].value, 10) || 0,
        note: inputs[4].value.trim()
      });
    });
    return result;
  }

  // localStorage 헬퍼
  function saveToLocal() {
    try { localStorage.setItem('strikeData', JSON.stringify(data)); } catch (e) { }
  }

  function loadFromLocal() {
    try {
      const s = localStorage.getItem('strikeData');
      return s ? JSON.parse(s) : [];
    } catch (e) {
      return [];
    }
  }

  // 데이터 저장
  function saveData() {
    data = getTableData();
    const apiUrl = isFileProtocol ? 'http://localhost:8080/api/data' : '/api/data';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      if (xhr.status === 200) {
        renderSummary();
        renderChart();
        showToast('저장되었습니다.');
      } else {
        saveToLocal();
        renderSummary();
        renderChart();
        showToast('서버 오류 - 로컬에 임시 저장되었습니다.');
      }
    };
    xhr.onerror = function () {
      saveToLocal();
      renderSummary();
      renderChart();
      showToast('서버 연결 실패 - 로컬에 임시 저장되었습니다.');
    };
    xhr.send(JSON.stringify(data));
  }

  // 요약 정보 렌더링
  function renderSummary() {
    let totalAll = 0;
    let partAll = 0;
    for (let i = 0; i < data.length; i++) {
      totalAll += data[i].total;
      partAll += data[i].part;
    }
    const pct = totalAll > 0 ? ((partAll / totalAll) * 100).toFixed(1) : '0';
    const el1 = document.getElementById('summaryPercent');
    const el2 = document.getElementById('summaryPart');
    const el3 = document.getElementById('summaryTotal');
    if (el1) el1.innerHTML = pct + '<span class="unit">%</span>';
    if (el2) el2.textContent = String(partAll);
    if (el3) el3.textContent = String(totalAll);
  }

  // 차트 렌더링
  function renderChart() {
    const container = document.getElementById('chartContainer');
    if (!container) return;

    // 그룹핑
    const grouped = {};
    const groupOrder = [];
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const key = d.division ? (d.division + ' / ' + d.dept) : (d.dept || '미입력');
      if (!grouped[key]) {
        grouped[key] = { total: 0, part: 0 };
        groupOrder.push(key);
      }
      grouped[key].total += d.total;
      grouped[key].part += d.part;
    }

    if (groupOrder.length === 0) {
      container.innerHTML = '<div class="no-data-msg">아래 테이블에 데이터를 입력한 후 저장하면 그래프가 표시됩니다.</div>';
      return;
    }

    // entries 배열 생성
    const entries = [];
    for (let k = 0; k < groupOrder.length; k++) {
      entries.push([groupOrder[k], grouped[groupOrder[k]]]);
    }

    // 참여율 내림차순 정렬
    entries.sort(function (a, b) {
      const ra = a[1].total > 0 ? a[1].part / a[1].total : 0;
      const rb = b[1].total > 0 ? b[1].part / b[1].total : 0;
      return rb - ra;
    });

    let html = '';
    for (let j = 0; j < entries.length; j++) {
      const label = entries[j][0];
      const val = entries[j][1];
      const pct = val.total > 0 ? ((val.part / val.total) * 100).toFixed(1) : '0';
      const colorClass = parseFloat(pct) < 50 ? 'bar-danger' : 'bar-normal';
      const valueStyle = parseFloat(pct) < 50 ? 'color:#e74c3c' : '';
      html +=
        '<div class="chart-row">' +
        '<div class="chart-label" title="' + escHtml(label) + '">' + escHtml(label) + '</div>' +
        '<div class="chart-bar-wrap">' +
        '<div class="chart-bar ' + colorClass + '" style="width:0%;" data-width="' + pct + '"></div>' +
        '</div>' +
        '<div class="chart-value" style="' + valueStyle + '">' + pct + '%</div>' +
        '</div>';
    }

    container.innerHTML = html;

    // 바 애니메이션
    setTimeout(function () {
      container.querySelectorAll('.chart-bar').forEach(function (bar) {
        bar.style.width = bar.getAttribute('data-width') + '%';
      });
    }, 100);
  }

  // 토스트 메시지
  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show';
    setTimeout(function () {
      toast.className = 'toast';
    }, 2000);
  }

  // 행 로드
  function loadRows() {
    if (data.length === 0) {
      addRow();
    } else {
      for (let i = 0; i < data.length; i++) {
        addRow(data[i]);
      }
    }
    renderSummary();
    renderChart();
  }

  // 초기화
  function init() {
    const apiUrl = isFileProtocol ? 'http://localhost:8080/api/data' : '/api/data';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl, true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try { data = JSON.parse(xhr.responseText); } catch (e) { data = []; }
      } else {
        data = loadFromLocal();
      }
      loadRows();
    };
    xhr.onerror = function () {
      data = loadFromLocal();
      loadRows();
    };
    xhr.send(null);
  }

  // 전역에 함수 노출
  window._app = {
    addRow: addRow,
    deleteRow: deleteRow,
    sortTable: sortTable,
    saveData: saveData
  };

  // DOM 로드 후 초기화 및 이벤트 바인딩
  function setup() {
    init();

    // 1. 테이블 내 동적 버튼(삭제) 이벤트 위임
    const tbody = document.getElementById('tableBody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        if (e.target && e.target.classList.contains('btn-delete')) {
          deleteRow(e.target);
        }
      });
    }

    // 2. 컬럼 헤더 정렬 이벤트 바인딩
    const sortHeaders = document.querySelectorAll('thead th.sortable');
    sortHeaders.forEach(function (th) {
      th.addEventListener('click', function () {
        sortTable(this);
      });
    });

    // 3. 컨트롤 버튼 바인딩
    const btnAdd = document.getElementById('btnAdd');
    if (btnAdd) {
      btnAdd.addEventListener('click', function () {
        addRow();
      });
    }

    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
      btnSave.addEventListener('click', function () {
        saveData();
      });
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setup();
  } else {
    document.addEventListener('DOMContentLoaded', setup);
  }
})();
