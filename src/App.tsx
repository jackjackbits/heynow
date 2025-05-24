import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AutoNostrProvider } from '@/components/AutoNostrProvider';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { HomePage } from '@/pages/HomePage';
import { RoomPage } from '@/pages/RoomPage';

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
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/:room" element={<RoomPage />} />
            </Routes>
          </BrowserRouter>
        </ViewModeProvider>
      </AutoNostrProvider>
    </QueryClientProvider>
  );
}

export default App;