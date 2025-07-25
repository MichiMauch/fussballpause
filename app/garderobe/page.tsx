'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import AuthPage from '@/components/AuthPage';
import UserAvatar from '@/components/UserAvatar';
import Layout from '@/components/Layout';
import UserStatsCard from '@/components/UserStatsCard';
import Leaderboard from '@/components/Leaderboard';

interface PendingChallenge {
  id: string;
  challengerEmail: string;
  challengerUsername: string;
  challengerAvatar: string;
  createdAt: string;
  type: 'invitation' | 'active' | 'waiting_for_opponent' | 'cancelable' | 'finished_recent';
  role: 'defender' | 'challenger';
  winner?: string;
}

export default function Garderobe() {
  const [matchId, setMatchId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [pendingChallenges, setPendingChallenges] = useState<PendingChallenge[]>([]);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);
  const [viewedMatches, setViewedMatches] = useState<Set<string>>(() => {
    // Load viewed matches from localStorage on init
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('viewedFinishedMatches');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  // Fetch pending challenges when user is loaded
  useEffect(() => {
    if (user) {
      fetchPendingChallenges();
    }
  }, [user]);

  const fetchPendingChallenges = async () => {
    try {
      const response = await fetch('/api/matches/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingChallenges(data.challenges);
      }
    } catch (error) {
      console.error('Error fetching pending challenges:', error);
    } finally {
      setIsLoadingChallenges(false);
    }
  };

  const declineChallenge = async (challengeId: string) => {
    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'decline-challenge', 
          matchId: challengeId,
          email: user?.email
        })
      });
      
      if (response.ok) {
        // Refresh the challenges list
        fetchPendingChallenges();
      } else {
        const data = await response.json();
        setError(data.error || 'Fehler beim Ablehnen der Herausforderung');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    }
  };

  const cancelChallenge = async (challengeId: string) => {
    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'cancel-challenge', 
          matchId: challengeId,
          email: user?.email
        })
      });
      
      if (response.ok) {
        // Refresh the challenges list
        fetchPendingChallenges();
      } else {
        const data = await response.json();
        setError(data.error || 'Fehler beim Löschen der Herausforderung');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    }
  };

  // Save viewed matches to localStorage
  const saveViewedMatches = (matches: Set<string>) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('viewedFinishedMatches', JSON.stringify([...matches]));
    }
  };

  const acceptChallenge = async (challengeId: string, type: 'invitation' | 'active' | 'waiting_for_opponent' | 'cancelable' | 'finished_recent') => {
    if (type === 'invitation') {
      // Join the match as player B
      const playerId = nanoid();
      try {
        const response = await fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'join', 
            matchId: challengeId, 
            playerId,
            email: user?.email,
            username: user?.username,
            avatar: user?.avatar
          })
        });
        
        if (response.ok) {
          localStorage.setItem('playerId', playerId);
          router.push(`/game/${challengeId}`);
        } else {
          const data = await response.json();
          setError(data.error || 'Fehler beim Beitreten des Matches');
        }
      } catch (err) {
        setError('Netzwerkfehler');
      }
    } else {
      // Mark finished games as viewed when opening them
      if (type === 'finished_recent') {
        const newViewedMatches = new Set([...viewedMatches, challengeId]);
        setViewedMatches(newViewedMatches);
        saveViewedMatches(newViewedMatches);
      }
      // Just navigate to the match (active, waiting_for_opponent, cancelable, or finished_recent)
      router.push(`/game/${challengeId}`);
    }
  };

  // Show auth page if not logged in
  if (loading) {
    return (
      <Layout showHeader={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">⚽ Lade Fußballpause...</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout showHeader={false}>
        <AuthPage />
      </Layout>
    );
  }
  
  const createMatch = async () => {
    setIsCreating(true);
    setError('');
    
    try {
      const playerId = nanoid();
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create', 
          playerId, 
          email: user.email,
          username: user.username,
          avatar: user.avatar
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('playerId', playerId);
        router.push(`/game/${data.matchId}`);
      } else {
        setError(data.error || 'Fehler beim Erstellen des Matches');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setIsCreating(false);
    }
  };
  
  const joinMatch = async () => {
    if (!matchId.trim()) {
      setError('Bitte gib eine Match-ID ein');
      return;
    }
    
    setIsJoining(true);
    setError('');
    
    try {
      const playerId = nanoid();
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'join', 
          matchId: matchId.trim(), 
          playerId,
          email: user.email,
          username: user.username,
          avatar: user.avatar
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('playerId', playerId);
        router.push(`/game/${matchId.trim()}`);
      } else {
        setError(data.error || 'Fehler beim Beitreten des Matches');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setIsJoining(false);
    }
  };
  
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-600 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Main Game Area */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Pending Challenges - Show prominently at top */}
              {!isLoadingChallenges && pendingChallenges.filter(challenge => 
                !(challenge.type === 'finished_recent' && viewedMatches.has(challenge.id))
              ).length > 0 && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg shadow-xl p-6 border-2 border-yellow-300">
                  <div className="flex items-center mb-4">
                    <span className="text-3xl mr-3">🔥</span>
                    <h2 className="text-2xl font-bold text-white">
                      Deine Elfmeter-Aktivitäten
                    </h2>
                    <span className="ml-auto bg-white text-red-600 px-3 py-1 rounded-full font-bold text-sm">
                      {pendingChallenges.filter(challenge => 
                        !(challenge.type === 'finished_recent' && viewedMatches.has(challenge.id))
                      ).length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {pendingChallenges.filter(challenge => 
                      !(challenge.type === 'finished_recent' && viewedMatches.has(challenge.id))
                    ).map((challenge) => (
                      <div
                        key={challenge.id}
                        className="bg-white/10 backdrop-blur rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <UserAvatar 
                            user={{
                              id: '',
                              email: challenge.challengerEmail,
                              username: challenge.challengerUsername,
                              avatar: challenge.challengerAvatar as any,
                              created_at: '',
                              updated_at: ''
                            }} 
                            size="sm" 
                          />
                          <div>
                            <p className="text-white font-semibold">
                              {challenge.challengerUsername}
                            </p>
                            <p className="text-white/80 text-sm">
                              {challenge.role === 'defender' && challenge.type === 'invitation' && 'Möchte gegen dich spielen'}
                              {challenge.role === 'defender' && challenge.type === 'active' && 'Wartet auf deinen Zug'}
                              {challenge.role === 'challenger' && challenge.type === 'waiting_for_opponent' && 'Hat deine Herausforderung angenommen!'}
                              {challenge.type === 'cancelable' && 'Deine Herausforderung wartet auf einen Gegner'}
                              {challenge.type === 'finished_recent' && 'Spiel beendet - Ergebnis ansehen'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          {/* Accept/Continue button */}
                          <button
                            onClick={() => acceptChallenge(challenge.id, challenge.type)}
                            className="px-6 py-2 bg-white text-red-600 font-bold rounded-full hover:bg-yellow-100 transform hover:scale-105 transition-all duration-200 shadow-lg"
                          >
                            {challenge.role === 'defender' && challenge.type === 'invitation' && '⚽ Annehmen'}
                            {challenge.role === 'defender' && challenge.type === 'active' && '🧤 Weiter spielen'}
                            {challenge.role === 'challenger' && challenge.type === 'waiting_for_opponent' && '⚽ Spiel öffnen'}
                            {challenge.type === 'cancelable' && '⚽ Zum Spiel'}
                            {challenge.type === 'finished_recent' && '📊 Ergebnis ansehen'}
                          </button>
                          
                          {/* Decline button for invitations */}
                          {challenge.role === 'defender' && challenge.type === 'invitation' && (
                            <button
                              onClick={() => declineChallenge(challenge.id)}
                              className="px-4 py-2 bg-gray-500 text-white font-bold rounded-full hover:bg-gray-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                            >
                              ❌ Ablehnen
                            </button>
                          )}
                          
                          {/* Cancel button for challenges you created */}
                          {challenge.type === 'cancelable' && (
                            <button
                              onClick={() => cancelChallenge(challenge.id)}
                              className="px-4 py-2 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                            >
                              🗑️ Löschen
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* User Stats Dashboard */}
              <UserStatsCard 
                userId={user.id}
                username={user.username}
                avatar={user.avatar}
              />
              
              {/* Quick Play Section */}
              <div className="bg-white rounded-lg shadow-xl p-8">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">⚽ Spiel starten</h1>
                  <p className="text-gray-600">Bereit für ein neues Elfmeter-Duell?</p>
                </div>
              
                <div className="space-y-6">
                  <div className="space-y-4">
                    <button
                      onClick={createMatch}
                      disabled={isCreating}
                      className="w-full px-6 py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg transition-colors"
                    >
                      {isCreating ? 'Wird erstellt...' : '⚽ Als Schütze starten'}
                    </button>
                  </div>
                  
                  <div className="text-center text-gray-500">oder</div>
                  
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Match-ID eingeben"
                      value={matchId}
                      onChange={(e) => setMatchId(e.target.value)}
                      className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={joinMatch}
                      disabled={isJoining}
                      className="w-full px-6 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg transition-colors"
                    >
                      {isJoining ? 'Trete bei...' : '🧤 Als Torwart beitreten'}
                    </button>
                  </div>
                </div>
                
                {error && (
                  <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}
              </div>
              
              {/* Game Rules */}
              <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-800">⚽ Spielregeln</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <h4 className="font-semibold text-green-600 mb-2">Als Schütze:</h4>
                    <ul className="space-y-1">
                      <li>• Wähle 5 Schussrichtungen</li>
                      <li>• +10 Punkte pro Tor</li>
                      <li>• +100 Bonus bei 5/5 Toren</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-600 mb-2">Als Torwart:</h4>
                    <ul className="space-y-1">
                      <li>• Wähle 5 Paraden-Richtungen</li>
                      <li>• +15 Punkte pro Parade</li>
                      <li>• +100 Bonus bei 5/5 Paraden</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                  <p className="text-sm text-yellow-800">
                    <strong>Bonuspunkte:</strong> +50 für Sieg, +20 für Unentschieden, +300 für 5er-Serie
                  </p>
                </div>
              </div>
            </div>
            
            {/* Sidebar */}
            <div className="space-y-8">
              <Leaderboard />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}