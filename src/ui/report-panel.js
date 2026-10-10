/* report-panel.js — فاز ۲: خط گلوگاه روی صفحهٔ امروز
 * درصد ۸۰/۵۰ را پاک نمی‌کند. مسیر بازی را عوض نمی‌کند.
 * جمله از جدول ثابت گلوگاه می‌آید، با مثال از دفتر واقعی دانش‌آموز.
 */
(function (root, factory) {
  var api = factory();
  if (root) root.ReportPanel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function fa(n) {
    return String(n).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; });
  }

  // ─── نام‌های ساده‌ی گلوگاه‌ها (برای معلم) ───
  var PLAIN_NAMES = {
    'G': 'جمع کردن به‌جای ضرب',
    'S': 'یک قدم گم در شمارش',
    'A': 'یک خانه کم در آرایه',
    'D': 'دوبرابر را حساب نکردن',
    'N': 'حاصل جدول کناری',
    'P': 'جابه‌جا نوشتن رقم‌ها',
    'C': 'نشناختن شکل ضرب'
  };

  // ─── تبدیل رویدادهای خام به رویدادهای قابل تشخیص ───
  function eventsFromStudent(student) {
    if (!student) return [];
    if (Array.isArray(student.events) && student.events.length) return student.events;

    var events = [];
    (student.details || []).forEach(function (detail) {
      // پاسخ‌های غلط
      (detail.wrongAnswers || []).forEach(function (given) {
        events.push({
          f1: detail.f1,
          f2: detail.f2,
          correct: false,
          given: Number(given),
          assisted: false,
          filler: false
        });
      });
      // پاسخ‌های درست (برای تشخیص دوبرابر و پیش‌نیازها)
      var correctCount = detail.correctCount || 0;
      for (var i = 0; i < correctCount; i++) {
        events.push({
          f1: detail.f1,
          f2: detail.f2,
          correct: true,
          given: detail.f1 * detail.f2,
          assisted: false,
          filler: false
        });
      }
    });
    return events;
  }

  // ─── ساخت مثال از دفتر واقعی دانش‌آموز ───
  function buildExample(student, bottleneckId) {
    var details = (student && student.details) || [];
    var examples = [];

    details.forEach(function (d) {
      var fact = d.f1 + '×' + d.f2;
      var product = d.f1 * d.f2;

      switch (bottleneckId) {
        case 'G':
          // جمع به‌جای ضرب
          if ((d.wrongAnswers || []).indexOf(d.f1 + d.f2) !== -1) {
            examples.push(fact + ' را ' + fa(d.f1 + d.f2) + ' نوشته (به‌جای ' + fa(product) + ')');
          }
          break;
        case 'P':
          // جابه‌جایی رقم‌ها
          var swapped = String(product).length === 2
            ? parseInt(String(product).split('').reverse().join(''), 10)
            : null;
          if (swapped && (d.wrongAnswers || []).indexOf(swapped) !== -1) {
            examples.push(fact + ' را ' + fa(swapped) + ' نوشته (به‌جای ' + fa(product) + ')');
          }
          break;
        case 'N':
          // حاصل جدول کناری (TABLE)
          (d.wrongAnswers || []).forEach(function (given) {
            if (given !== product && given % d.f1 === 0 && given / d.f1 >= 2 && given / d.f1 <= 9) {
              examples.push(fact + ' را ' + fa(given) + ' نوشته (به‌جای ' + fa(product) + ')');
            }
          });
          break;
        case 'S':
        case 'A':
          // یک کم یا یک زیاد
          if ((d.wrongAnswers || []).indexOf(product - d.f1) !== -1 ||
              (d.wrongAnswers || []).indexOf(product + d.f1) !== -1) {
            examples.push(fact + ' را اشتباه شمرده');
          }
          break;
        case 'D':
          examples.push(fact + ' را اشتباه حساب کرده');
          break;
      }
    });

    return examples.slice(0, 2); // حداکثر دو مثال
  }

  // ─── تشخیص همه دانش‌آموزان ───
  function diagnoseAll(students) {
    return (Array.isArray(students) ? students : []).map(function (student) {
      var events = eventsFromStudent(student);
      var diagnosis = Bottleneck.diagnoseStudent(events, student.profileId || student.id || student.name);
      diagnosis.name = student.name || 'بدون نام';
      diagnosis.rawStudent = student;
      diagnosis.hasEvents = events.length > 0;
      return diagnosis;
    });
  }

  function nameOf(diagnoses, profileId) {
    for (var i = 0; i < diagnoses.length; i++) {
      if (diagnoses[i].profileId === profileId) return diagnoses[i].name;
    }
    return profileId || 'بدون نام';
  }

  // ─── ساخت گزارش کلاس ───
  function build(students) {
    var diagnoses = diagnoseAll(students);
    var withEvents = diagnoses.filter(function (row) { return row.hasEvents; });

    if (!withEvents.length) {
      return {
        kind: 'no-data',
        line: 'داده‌ای برای تشخیص نیست.',
        names: [],
        tomorrow: '',
        individuals: diagnoses
      };
    }

    var klass = Bottleneck.diagnoseClass(withEvents);
    if (!klass.primaryBottleneck) {
      return {
        kind: 'no-pattern',
        line: 'الگوی مشترک نیست. هر دانش‌آموز گلوگاه خودش را دارد.',
        names: [],
        tomorrow: '',
        individuals: diagnoses,
        shared: klass.shared
      };
    }

    var primary = klass.primaryBottleneck;
    var plainName = PLAIN_NAMES[primary.id] || primary.name;

    // جمع‌آوری مثال‌ها از دانش‌آموزان درگیر
    var allExamples = [];
    primary.students.forEach(function (s) {
      var studentDiagnosis = diagnoses.filter(function (d) {
        return d.profileId === s.profileId;
      })[0];
      if (studentDiagnosis && studentDiagnosis.rawStudent) {
        var examples = buildExample(studentDiagnosis.rawStudent, primary.id);
        allExamples = allExamples.concat(examples);
      }
    });

    // حذف تکراری‌ها
    var uniqueExamples = [];
    allExamples.forEach(function (ex) {
      if (uniqueExamples.indexOf(ex) === -1) uniqueExamples.push(ex);
    });

    return {
      kind: 'class',
      id: primary.id,
      plainName: plainName,
      line: 'گلوگاه کلاس: ' + plainName + '. ' + fa(primary.count) + ' نفر.',
      tomorrow: primary.tomorrow,
      examples: uniqueExamples.slice(0, 2),
      names: primary.students.map(function (s) {
        return { name: nameOf(diagnoses, s.profileId), facts: s.facts };
      }),
      individuals: diagnoses
    };
  }

  // ─── کارت یک دانش‌آموز ───
  function studentCard(student) {
    var events = eventsFromStudent(student);
    if (!events.length) return { kind: 'no-data', line: 'داده‌ای نیست.', facts: [], tomorrow: '' };

    var diagnosis = Bottleneck.diagnoseStudent(events, student.profileId || student.name);
    if (!diagnosis.primaryBottleneck) {
      return {
        kind: 'no-pattern',
        line: 'مشکلی دیده نشد.',
        facts: [],
        tomorrow: 'به تمرین‌های عادی ادامه دهید.'
      };
    }

    var primary = diagnosis.primaryBottleneck;
    var plainName = PLAIN_NAMES[primary.id] || primary.name;
    var examples = buildExample(student, primary.id);

    return {
      kind: 'student',
      id: primary.id,
      line: plainName,
      facts: primary.facts,
      tomorrow: primary.tomorrow,
      examples: examples,
      blocksSector: primary.blocksSector
    };
  }

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── رندر کارت کلاس ───
  function renderToday(host, students) {
    if (!host) return build(students);

    var report = build(students);
    var examplesHtml = '';

    if (report.examples && report.examples.length) {
      examplesHtml = '<p class="report-facts">مثال: ' +
        report.examples.map(function (e) { return esc(e); }).join(' • ') +
        '</p>';
    }

    var names = report.names.map(function (row) {
      return '<div class="report-name"><span>' + esc(row.name) + '</span><span>' +
        esc(row.facts.join(' ، ')) + '</span></div>';
    }).join('');

    var open = names
      ? '<button type="button" class="report-open" data-report-open>نام‌ها</button>' +
        '<div class="report-names" hidden>' + names + '</div>'
      : '';

    var tomorrow = report.tomorrow
      ? '<p class="report-tomorrow">فردا: ' + esc(report.tomorrow) + '</p>'
      : '';

    host.innerHTML = '<p class="report-line">' + esc(report.line) + '</p>' +
      examplesHtml + tomorrow + open;

    var button = host.querySelector('[data-report-open]');
    if (button) {
      button.addEventListener('click', function () {
        var box = host.querySelector('.report-names');
        if (box) box.hidden = !box.hidden;
      });
    }
    return report;
  }

  // ─── رندر کارت یک دانش‌آموز ───
  function renderStudent(host, student) {
    var card = studentCard(student);
    if (!host) return card;

    var facts = card.facts && card.facts.length
      ? '<p class="report-facts">ضرب‌های درگیر: ' + esc(card.facts.join(' ، ')) + '</p>'
      : '';

    var examples = card.examples && card.examples.length
      ? '<p class="report-facts">مثال: ' + card.examples.map(function (e) { return esc(e); }).join(' • ') + '</p>'
      : '';

    var tomorrow = card.tomorrow
      ? '<p class="report-tomorrow">فردا: ' + esc(card.tomorrow) + '</p>'
      : '';

    host.innerHTML = '<p class="report-line">' + esc(card.line) + '</p>' +
      facts + examples + tomorrow;
    return card;
  }

  // ─── ساخت کارت در صفحه‌ی «امروز» ───
  function mountToday() {
    var page = document.getElementById('page-today');
    if (!page || document.getElementById('today-bottleneck')) return;

    var card = document.createElement('div');
    card.className = 'summary-card-v2 report-card';
    card.innerHTML = '<div class="summary-header">گلوگاه کلاس</div>' +
      '<div class="summary-body" id="today-bottleneck"></div>';
    page.insertBefore(card, page.firstChild);
  }

  return {
    eventsFromStudent: eventsFromStudent,
    build: build,
    studentCard: studentCard,
    renderToday: renderToday,
    renderStudent: renderStudent,
    mountToday: mountToday
  };
});
