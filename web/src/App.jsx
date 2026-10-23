import { Component, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";

import { AuthProvider, Protected } from "@/lib/auth";
import { AdminPage } from "@/pages/Admin";
import { AppHome } from "@/pages/AppHome";
import { CropPage, CropsPage } from "@/pages/Crops";
import { ErrorPage, NotFound } from "@/pages/Errors";
import { HistoryPage } from "@/pages/History";
import { Landing } from "@/pages/Landing";
import { LimitationsPage } from "@/pages/Limitations";
import { ForgotPasswordPage, GoogleCallbackPage, LoginPage, RegisterPage, ResetPasswordPage } from "@/pages/Auth";
import { PrivacyPage } from "@/pages/Privacy";
import { ProfilePage } from "@/pages/Profile";
import { ResultPage } from "@/pages/Result";
import { TermsPage } from "@/pages/Terms";

class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ErrorPage reset={() => this.setState({ failed: false })} /> : this.props.children;
  }
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [location]);
  return null;
}

export function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <ScrollToTop />
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/auth/google" component={GoogleCallbackPage} />
          <Route path="/crops" component={CropsPage} />
          <Route path="/crops/:crop" component={CropPage} />
          <Route path="/limitations" component={LimitationsPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/app">
            <Protected>
              <AppHome />
            </Protected>
          </Route>
          <Route path="/app/history">
            <Protected>
              <HistoryPage />
            </Protected>
          </Route>
          <Route path="/app/profile">
            <Protected>
              <ProfilePage />
            </Protected>
          </Route>
          <Route path="/app/results/:id">
            {(params) => (
              <Protected>
                <ResultPage id={params.id} />
              </Protected>
            )}
          </Route>
          <Route path="/admin">
            <Protected admin>
              <AdminPage />
            </Protected>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </AuthProvider>
  );
}
