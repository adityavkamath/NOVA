export async function fetchChatSessions(userId: string, featureType?: string) {
  try {
    const url = new URL('/api/chat/', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');
    
    if (featureType) {
      url.searchParams.append('feature_type', featureType);
    }
    url.searchParams.append('limit', '50');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'user-id': userId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    throw error;
  }
}

export async function fetchMultiSourceChatSessions(userId: string) {
  try {
    const url = new URL('/api/multi/sessions', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'user-id': userId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching multi-source chat sessions:', error);
    throw error;
  }
}

export async function fetchFirstMessage(sessionId: string, userId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/chat/${sessionId}/messages?limit=1`, {
      method: 'GET',
      headers: {
        'user-id': userId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching first message:', error);
    throw error;
  }
}

export async function fetchMultiSourceFirstMessage(sessionId: string, userId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/multi/sessions/${sessionId}/messages`, {
      method: 'GET',
      headers: {
        'user-id': userId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching multi-source first message:', error);
    throw error;
  }
}

export async function fetchAgentChatSessions(userId: string) {
  try {
    const url = new URL('/api/agents/sessions', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'user-id': userId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching agent chat sessions:', error);
    return { success: false, error };
  }
}

export async function fetchAgentFirstMessage(sessionId: string, userId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/agents/sessions/${sessionId}/messages`, {
      method: 'GET',
      headers: {
        'user-id': userId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching agent first message:', error);
    return { success: false, error };
  }
}
