import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useState, useEffect } from "react";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Workers from "./pages/Workers";
import Clients from "./pages/Clients";
import Availability from "./pages/Availability";
import Demands from "./pages/Demands";
import DemandDetail from "./pages/DemandDetail";
import ActualTime from "./pages/ActualTime";
import Reports from "./pages/Reports";
import DashboardLayout from "./components/DashboardLayout";
import AdminSettings from "./pages/AdminSettings";
import WorkerDetail from "./pages/WorkerDetail";
import ClientDetail from "./pages/ClientDetail";
import DemandTypes from "./pages/DemandTypes";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/workers" component={() => <DashboardLayout><Workers /></DashboardLayout>} />
      <Route path="/workers/:id" component={() => <DashboardLayout><WorkerDetail /></DashboardLayout>} />
      <Route path="/clients" component={() => <DashboardLayout><Clients /></DashboardLayout>} />
      <Route path="/clients/:id" component={() => <DashboardLayout><ClientDetail /></DashboardLayout>} />
      <Route path="/availability" component={() => <DashboardLayout><Availability /></DashboardLayout>} />
      <Route path="/demands" component={() => <DashboardLayout><Demands /></DashboardLayout>} />
      <Route path="/demands/:id" component={() => <DashboardLayout><DemandDetail /></DashboardLayout>} />
      <Route path="/actual-time" component={() => <DashboardLayout><ActualTime /></DashboardLayout>} />
      <Route path="/reports" component={() => <DashboardLayout><Reports /></DashboardLayout>} />
      <Route path="/demand-types" component={() => <DashboardLayout><DemandTypes /></DashboardLayout>} />
      <Route path="/admin" component={() => <DashboardLayout><AdminSettings /></DashboardLayout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 模擬應用程式初始化
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <LoadingScreen isLoading={isLoading} />
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
