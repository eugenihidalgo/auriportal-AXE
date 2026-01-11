/**
 * STUDENTS REPOSITORY v1 - AuriPortal
 * 
 * Repositorio canónico para students (UUID-only, mundo nuevo).
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - students.id (UUID) es la identidad soberana del alumno
 * - NO usar alumnos.id (legacy)
 * - Email es único (case-insensitive)
 * 
 * RESPONSABILIDADES:
 * - Crear students (UUID-only, sin legacy)
 * - Buscar por email (case-insensitive)
 * - Listar students
 */

export class StudentsRepo {
  constructor(infraRepo) {
    this.infraRepo = infraRepo;
  }

  /**
   * Crea un nuevo student (UUID-only, mundo nuevo)
   * Idempotente por email: si ya existe, retorna el existente
   * 
   * @param {Object} data - Datos del student
   * @param {string} data.email - Email del student (requerido, único)
   * @param {string} [data.apodo] - Apodo del student (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Student creado o existente
   */
  async createStudent(data, client = null) {
    const { email, apodo = null } = data;
    
    if (!email) {
      throw new Error('email es requerido para crear un student');
    }
    
    // Buscar por email primero (idempotencia)
    const existing = await this.getStudentByEmail(email, client);
    if (existing) {
      return existing;
    }
    
    // Crear nuevo student
    return await this.infraRepo.create({ email, apodo }, client);
  }

  /**
   * Busca un student por email (case-insensitive)
   * 
   * @param {string} email - Email del student
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Student encontrado o null
   */
  async getStudentByEmail(email, client = null) {
    if (!email) return null;
    
    return await this.infraRepo.getByEmail(email, client);
  }

  /**
   * Lista todos los students
   * 
   * @param {Object} [options] - Opciones de listado
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de students
   */
  async listStudents(options = {}, client = null) {
    return await this.infraRepo.list(options, client);
  }

  /**
   * Busca un student por ID (UUID)
   * 
   * @param {string} id - UUID del student
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Student encontrado o null
   */
  async getStudentById(id, client = null) {
    if (!id) return null;
    
    return await this.infraRepo.getById(id, client);
  }
}
