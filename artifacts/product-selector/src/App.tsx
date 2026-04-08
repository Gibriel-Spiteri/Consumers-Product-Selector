import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "@/components/layout";
import Home from "@/pages/home";
import CategoryOverview from "@/pages/category-overview";
import CategoryProducts from "@/pages/category-products";
import SearchPage from "@/pages/search";
import UncategorizedProducts from "@/pages/uncategorized-products";
import QuoteListPage from "@/pages/quote-list";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { QuoteListProvider } from "@/context/quote-list-context";
import { AuthProvider, useAuth } from "@/context/auth-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function AuthenticatedApp() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <QuoteListProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/category/:categoryId" component={CategoryOverview} />
            <Route path="/products/:categoryId" component={CategoryProducts} />
            <Route path="/search/:query" component={SearchPage} />
            <Route path="/uncategorized" component={UncategorizedProducts} />
            <Route path="/list" component={QuoteListPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </WouterRouter>
    </QuoteListProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
