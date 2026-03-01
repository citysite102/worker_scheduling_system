import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Users,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ClipboardList,
  Eye,
  PartyPopper,
  ArrowRight,
} from "lucide-react";

interface ClientOnboardingProps {
  clientName: string;
  userName: string;
  onComplete: (navigateToDemand?: boolean) => void;
}

const steps = [
  {
    id: 1,
    title: "歡迎使用員工排班系統",
    subtitle: "讓我們花 2 分鐘，帶你快速了解如何使用這個平台",
    icon: Sparkles,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
    content: null,
  },
  {
    id: 2,
    title: "三大核心功能",
    subtitle: "這個平台提供以下功能，協助你高效管理用工需求",
    icon: ClipboardList,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50",
    content: "features",
  },
  {
    id: 3,
    title: "如何建立第一張需求單",
    subtitle: "只需 3 個步驟，即可完成用工需求申請",
    icon: FileText,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50",
    content: "guide",
  },
  {
    id: 4,
    title: "一切就緒！",
    subtitle: "你已完成引導設定，可以開始使用系統了",
    icon: PartyPopper,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
    content: "done",
  },
];

const features = [
  {
    icon: FileText,
    color: "text-blue-500",
    bg: "bg-blue-50",
    title: "提交需求單",
    desc: "填寫用工日期、時間、人數與需求類型，系統即時送出審核",
  },
  {
    icon: Eye,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    title: "追蹤進度",
    desc: "隨時查看需求單狀態：待審核、已確認、進行中、已完成",
  },
  {
    icon: Users,
    color: "text-violet-500",
    bg: "bg-violet-50",
    title: "查看指派員工",
    desc: "確認後可查看即將派遣的員工基本資料，掌握服務人員資訊",
  },
];

const guideSteps = [
  {
    step: "01",
    title: '點擊「需求管理」',
    desc: '從左側導覽列進入需求管理頁面',
    color: "bg-blue-500",
  },
  {
    step: "02",
    title: '點擊「建立需求單」',
    desc: '填寫日期、時間、人數、地點與需求類型',
    color: "bg-indigo-500",
  },
  {
    step: "03",
    title: "送出等待審核",
    desc: "提交後系統將通知管理員進行審核，審核通過後即安排員工",
    color: "bg-violet-500",
  },
];

export function ClientOnboarding({ clientName, userName, onComplete }: ClientOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const [navigateAfter, setNavigateAfter] = useState(false);

  const completeOnboarding = trpc.auth.completeOnboarding.useMutation({
    onSuccess: () => {
      onComplete(navigateAfter);
    },
    onError: () => {
      // 即使 API 失敗也繼續（不阻擋用戶）
      onComplete(navigateAfter);
    },
  });

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      setIsCompleting(true);
      setNavigateAfter(false);
      completeOnboarding.mutate();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleGoToDemand = () => {
    setIsCompleting(true);
    setNavigateAfter(true);
    completeOnboarding.mutate();
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    setIsCompleting(true);
    completeOnboarding.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Progress Bar */}
        <div className="h-1 bg-gray-100">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-violet-500"
            initial={{ width: "0%" }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-6 bg-blue-500"
                  : i < currentStep
                  ? "w-1.5 bg-blue-300"
                  : "w-1.5 bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 pt-4 pb-6 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col flex-1"
            >
              {/* Icon & Title */}
              <div className="flex flex-col items-center text-center mb-6">
                {step && (
                  <div className={`w-14 h-14 rounded-2xl ${step.iconBg} flex items-center justify-center mb-4`}>
                    <step.icon className={`w-7 h-7 ${step.iconColor}`} />
                  </div>
                )}
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {currentStep === 0 ? `${userName}，${step?.title}` : step?.title}
                </h2>
                <p className="text-sm text-gray-500">{step?.subtitle}</p>
                {currentStep === 0 && (
                  <p className="mt-2 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {clientName}
                  </p>
                )}
              </div>

              {/* Step Content */}
              {step?.content === "features" && (
                <div className="space-y-3 flex-1">
                  {features.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50"
                    >
                      <div className={`w-9 h-9 rounded-lg ${f.bg} flex items-center justify-center flex-shrink-0`}>
                        <f.icon className={`w-4 h-4 ${f.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{f.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {step?.content === "guide" && (
                <div className="space-y-3 flex-1">
                  {guideSteps.map((g, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.12 }}
                      className="flex items-start gap-4"
                    >
                      <div className={`w-8 h-8 rounded-full ${g.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-xs font-bold text-white">{g.step}</span>
                      </div>
                      <div className="flex-1 pb-3 border-b border-gray-100 last:border-0">
                        <p className="text-sm font-semibold text-gray-800">{g.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{g.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {step?.content === "done" && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  >
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                  </motion.div>
                  <div className="text-center space-y-1">
                    <p className="text-sm text-gray-600">你現在可以開始建立需求單</p>
                    <p className="text-sm text-gray-600">如有任何問題，請聯絡我們的客服團隊</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center mt-1">
                    {["建立需求單", "查看需求進度", "查看指派員工"].map((tag) => (
                      <span key={tag} className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-medium">
                        ✓ {tag}
                      </span>
                    ))}
                  </div>
                  {/* CTA 按鈕 */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="w-full mt-1"
                  >
                    <button
                      onClick={handleGoToDemand}
                      disabled={isCompleting}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:opacity-95 transition-all disabled:opacity-60"
                    >
                      {isCompleting && navigateAfter ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      立即建立第一張需求單
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <div>
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="text-gray-500"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一步
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-gray-400 text-xs"
                disabled={isCompleting}
              >
                跳過引導
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={isCompleting}
              className={`${
                isLast
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-blue-500 hover:bg-blue-600"
              } text-white px-5`}
            >
              {isCompleting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  進入系統...
                </span>
              ) : isLast ? (
                <span className="flex items-center gap-1">
                  開始使用
                  <Sparkles className="w-4 h-4 ml-1" />
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  下一步
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
