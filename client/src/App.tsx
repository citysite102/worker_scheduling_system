import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/workers" component={() => <DashboardLayout><Workers /></DashboardLayout>} />
      <Route path="/clients" component={() => <DashboardLayout><Clients /></DashboardLayout>} />
      <Route path="/availability" component={() => <DashboardLayout><Availability /></DashboardLayout>} />
      <Route path="/demands" component={() => <DashboardLayout><Demands /></DashboardLayout>} />
      <Route path="/demands/:id" component={() => <DashboardLayout><DemandDetail /></DashboardLayout>} />
      <Route path="/actual-time" component={() => <DashboardLayout><ActualTime /></DashboardLayout>} />
      <Route path="/reports" component={() => <DashboardLayout><Reports /></DashboardLayout>} />
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
  return (
    <ErrorBoundary>
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
