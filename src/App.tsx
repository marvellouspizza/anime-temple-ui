import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useWoodenFishSound } from "@/hooks/useWoodenFishSound";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import Home from "@/pages/Home";

// Use hash-based routing (/#/) to support opening index.html directly via file:// protocol
// Tolerant routing: unmatched paths are treated as anchor sections (e.g., /#/services → scroll to #services)
// For in-page anchors, use <Link href="/section"> instead of <a href="#section">
function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        {/* Add explicit routes here, e.g.: <Route path="/login" component={LoginPage} /> */}
        <Route path="/:section?">{(params) => <Home targetSection={params.section} />}</Route>
      </Switch>
    </Router>
  );
}

// Note on theming:
// - Choose defaultTheme based on your design (light or dark background)
// - Update the color palette in index.css to match
// - If you want switchable themes, add `switchable` prop and use `useTheme` hook

function App() {
  useWoodenFishSound();
  useBackgroundMusic();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="top-center" duration={1500} />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

