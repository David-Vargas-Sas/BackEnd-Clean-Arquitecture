export function createAuditoriaUseCases(repository) {
  return { list(filters) { return repository.list(filters); } };
}
