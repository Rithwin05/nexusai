import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Show, SignIn, SignUp } from "@clerk/react";
import { Toaster } from "sonner";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import AppShell from "@/components/layout/AppShell";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import Overview from "@/pages/Overview";
import KnowledgeBase from "@/pages/KnowledgeBase";
import DocumentDetail from "@/pages/DocumentDetail";
import Chat from "@/pages/Chat";
import Search from "@/pages/Search";
import Studio from "@/pages/Studio";
import Research from "@/pages/Research";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";

const Protected = ({ children }) => (
  <>
    <Show when="signed-in">{children}</Show>
    <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
  </>
);

const Home = () => (
  <>
    <Show when="signed-out"><Landing /></Show>
    <Show when="signed-in"><Navigate to="/app" replace /></Show>
  </>
);

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ClerkAuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/sign-in/*" element={<AuthPage><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></AuthPage>} />
            <Route path="/sign-up/*" element={<AuthPage><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthPage>} />
            <Route path="/app" element={<Protected><AppShell /></Protected>}>
              <Route index element={<Overview />} />
              <Route path="knowledge" element={<KnowledgeBase />} />
              <Route path="knowledge/:id" element={<DocumentDetail />} />
              <Route path="chat" element={<Chat />} />
              <Route path="chat/:id" element={<Chat />} />
              <Route path="search" element={<Search />} />
              <Route path="studio" element={<Studio />} />
              <Route path="research" element={<Research />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ClerkAuthProvider>
      </BrowserRouter>
      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "#0E1420", border: "1px solid #202C3D", color: "#F1F5F9" } }} />
    </div>
  );
}

export default App;
