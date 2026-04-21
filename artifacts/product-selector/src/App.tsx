import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "@/components/layout";
import Home from "@/pages/home";
import CategoryOverview from "@/pages/category-overview";
import CategoryProducts from "@/pages/category-products";
import SearchPage from "@/pages/search";
import UncategorizedProducts from "@/pages/uncategorized-products";
import WithoutAttributesProducts from "@/pages/without-attributes-products";
import ClearancePage from "@/pages/clearance";
import ExpressBathPage from "@/pages/express-bath";
import QuoteListPage from "@/pages/quote-list";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import { QuoteListProvider } from "@/context/quote-list-context";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { employee, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-300" size={32} />
      </div>
    );
  }

  if (!employee) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <QuoteListProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Layout>
                <Switch>
                  <Route path="/" component={Home} />
                  <Route path="/category/:categoryId" component={CategoryOverview} />
                  <Route path="/products/:categoryId" component={CategoryProducts} />
                  <Route path="/search/:query" component={SearchPage} />
                  <Route path="/uncategorized" component={UncategorizedProducts} />
                  <Route path="/without-attributes" component={WithoutAttributesProducts} />
                  <Route path="/clearance" component={ClearancePage} />
                  <Route path="/express-bath" component={ExpressBathPage} />
                  <Route path="/list" component={QuoteListPage} />
                  <Route path="/admin" component={AdminPage} />
                  <Route component={NotFound} />
                </Switch>
              </Layout>
            </WouterRouter>
          </QuoteListProvider>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
