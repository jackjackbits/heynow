import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AutoNostrProvider } from '@/components/AutoNostrProvider';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { HomePage } from '@/pages/HomePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AutoNostrProvider>
        <ViewModeProvider>
          <HomePage />
        </ViewModeProvider>
      </AutoNostrProvider>
    </QueryClientProvider>
  );
}

export default App;