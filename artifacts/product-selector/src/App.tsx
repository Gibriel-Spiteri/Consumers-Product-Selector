import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "@/components/layout";
import Home from "@/pages/home";
import CategoryOverview from "@/pages/category-overview";
import CategoryProducts from "@/pages/category-products";
import SearchPage from "@/pages/search";
import NotFound from "@/pages/not-found";

// Initialize React Query Client with optimal defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/category/:categoryId" component={CategoryOverview} />
            <Route path="/products/:categoryId" component={CategoryProducts} />
            <Route path="/search/:query" component={SearchPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
