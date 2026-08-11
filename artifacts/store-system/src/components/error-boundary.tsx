import React from "react";

/**
 * شبكة أمان.
 *
 * بدون هذا المكوّن، أي خطأ في أي صفحة كان يُسقط شجرة React كاملة،
 * فتظهر شاشة بيضاء تبقى بيضاء حتى مع التنقل، لأن التنقل داخل التطبيق
 * لا يعيد تحميل الصفحة. الآن يبقى العطل محصورًا في الصفحة نفسها.
 */

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Page crashed:", error);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div dir="rtl" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold">تعذر عرض هذه الصفحة</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          حدث خطأ أثناء تحميل الصفحة. باقي النظام يعمل بشكل طبيعي — يمكنك
          الرجوع أو تجربة صفحة أخرى من القائمة.
        </p>
        <div className="flex gap-2">
          <button
            onClick={this.handleReset}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            إعادة المحاولة
          </button>
          <button
            onClick={() => { window.location.href = "/dashboard"; }}
            className="rounded-md border px-4 py-2 text-sm"
          >
            الرجوع للرئيسية
          </button>
        </div>
      </div>
    );
  }
}
