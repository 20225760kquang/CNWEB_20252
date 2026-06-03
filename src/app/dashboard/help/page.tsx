"use client";

import React, { useMemo, useState } from "react";

const guides = [
  { icon: "videocam", title: "Xem camera trực tiếp", text: "Chọn camera, thay đổi bố cục lưới và chụp nhanh hình ảnh.", category: "Camera" },
  { icon: "replay", title: "Tìm và xem lại bản ghi", text: "Lọc bản ghi theo camera, ngày và mốc thời gian cần kiểm tra.", category: "Bản ghi" },
  { icon: "content_cut", title: "Xuất một đoạn video", text: "Chọn điểm bắt đầu, kết thúc và theo dõi trạng thái xử lý clip.", category: "Bản ghi" },
  { icon: "person_alert", title: "Kiểm tra sự kiện AI", text: "Xem ảnh phát hiện người và lọc sự kiện theo khoảng thời gian.", category: "AI" },
  { icon: "manage_accounts", title: "Phân quyền người dùng", text: "Gán camera và quyền xem lại, xuất clip cho từng tài khoản.", category: "Quản trị" },
  { icon: "settings", title: "Cài đặt tài khoản", text: "Đổi ngôn ngữ hiển thị và cập nhật mật khẩu đăng nhập.", category: "Tài khoản" },
];

const faqs = [
  ["Vì sao camera hiển thị ngoại tuyến?", "Kiểm tra nguồn điện, kết nối mạng và địa chỉ RTSP. Quản trị viên có thể mở trang Quản trị camera để cập nhật cấu hình."],
  ["Clip đã xuất được lưu trong bao lâu?", "Clip nằm trong mục Lưu trữ. Thời gian lưu phụ thuộc chính sách dung lượng do quản trị viên cấu hình."],
  ["Tôi không thấy một camera trong danh sách?", "Tài khoản có thể chưa được cấp quyền truy cập camera đó. Hãy liên hệ quản trị viên hệ thống."],
  ["Thông báo AI có thể tắt được không?", "Có thể tắt AI trên từng camera trong trang quản trị hoặc điều chỉnh quyền thông báo theo tài khoản."],
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const filtered = useMemo(() => guides.filter((guide) => `${guide.title} ${guide.text} ${guide.category}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <section className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-on-primary shadow-lg sm:px-12">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 right-28 h-64 w-64 rounded-full bg-secondary-fixed/10" />
        <div className="relative mx-auto max-w-2xl text-center">
          <span className="material-symbols-outlined text-4xl">support_agent</span>
          <h2 className="mt-3 text-3xl font-bold">Bạn cần hỗ trợ gì?</h2>
          <p className="mt-2 text-sm text-on-primary/80">Tìm hướng dẫn sử dụng nhanh cho hệ thống quản lý camera cam.ai.</p>
          <label className="mx-auto mt-7 flex max-w-xl items-center gap-3 rounded-2xl bg-white px-5 text-on-surface shadow-xl">
            <span className="material-symbols-outlined text-on-surface-variant">search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập nội dung bạn muốn tìm..." className="w-full bg-transparent py-4 text-sm outline-none" />
          </label>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between"><div><p className="text-sm font-semibold text-primary">Bắt đầu nhanh</p><h3 className="mt-1 text-xl font-bold">Hướng dẫn phổ biến</h3></div><span className="text-sm text-on-surface-variant">{filtered.length} chủ đề</span></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((guide) => (
            <button key={guide.title} className="group rounded-2xl bg-surface p-5 text-left shadow-sm ring-1 ring-outline-variant/30 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start gap-4"><span className="material-symbols-outlined rounded-xl bg-primary/10 p-3 text-primary">{guide.icon}</span><div className="flex-1"><span className="text-xs font-semibold uppercase tracking-wide text-primary">{guide.category}</span><h4 className="mt-1 font-semibold text-on-surface">{guide.title}</h4><p className="mt-2 text-sm leading-6 text-on-surface-variant">{guide.text}</p></div><span className="material-symbols-outlined text-on-surface-variant transition-transform group-hover:translate-x-1">arrow_forward</span></div>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-outline-variant/30">
          <h3 className="text-xl font-bold text-on-surface">Câu hỏi thường gặp</h3>
          <div className="mt-4 divide-y divide-outline-variant/30">
            {faqs.map(([question, answer], index) => (
              <div key={question} className="py-2">
                <button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 py-3 text-left font-semibold"><span>{question}</span><span className="material-symbols-outlined text-on-surface-variant">{openFaq === index ? "remove" : "add"}</span></button>
                {openFaq === index && <p className="pb-4 pr-10 text-sm leading-6 text-on-surface-variant">{answer}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-gradient-to-br from-secondary-container to-primary-fixed p-6 shadow-sm">
          <span className="material-symbols-outlined rounded-xl bg-surface/80 p-3 text-primary">mail</span>
          <h3 className="mt-5 text-xl font-bold text-on-surface">Vẫn chưa giải quyết được?</h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">Gửi yêu cầu cho quản trị viên. Hãy kèm tên camera, thời gian xảy ra lỗi và ảnh chụp màn hình nếu có.</p>
          <button className="mt-6 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-sm"><span className="material-symbols-outlined text-lg">send</span>Gửi yêu cầu hỗ trợ</button>
          <div className="mt-6 border-t border-primary/15 pt-5 text-sm text-on-surface-variant"><p>Thời gian phản hồi dự kiến</p><strong className="mt-1 block text-on-surface">Trong vòng 4 giờ làm việc</strong></div>
        </section>
      </div>
    </div>
  );
}
