export function createAuthController(useCases) {
  return {
    async login(req, res) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ data: await useCases.login(req.body) });
    },
    me(req, res) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ data: req.user });
    },
  };
}
