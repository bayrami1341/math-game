**بررسی PR #2 — وضعیت زنده ۱۰-۲۵ (trace 1a171130bb01db65)**

- چک سرِ head (`49344cf`, arena/0eb22280): «Validate official-base reconciliation and candidate» = **success** ✅
- اما GitHub: `mergeable=false / dirty` — merge پاک محاسبه نمی‌شود (سازگار با غیاب `refs/pull/2/merge` و پروب رسمی BP-022: ۱۵ تعارض واقعی، گزارش `reports/pr2-conflict-resolution-v1.fa.md`)
- نتیجه: **آماده برای بررسی بله؛ merge دکمه‌ای نه.** مسیر رسمی همان سند BP-022 است: انتقال انتخابی ویژگی‌های آرنا از این شاخه به سرِ رسمی v10.3-beta در شاخه‌های کوچک + PR تازه؛ تاریخچه‌ی `arena/*` دست‌نخورده می‌ماند
- تصمیم نهایی merge با مالک است
