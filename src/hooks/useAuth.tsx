  useEffect(() => {
    if (meData) {
      const u = meData as AuthUser;
      setUser(u);
      if (u.role) {
        const r = u.role as UserRole;
        setCurrentRole(r);
        localStorage.setItem("amos-role", r);
      }
      setIsLoading(false);
    } else if (!token) {
      setIsLoading(false);
    }
  }, [meData, token]);

  // Timeout: stop loading after 3 seconds even if query is stuck
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);
