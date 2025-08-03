# IoT Access Control and Authentication using Blockchain

A comprehensive IoT access control and authentication system built with blockchain technology, featuring real-time monitoring, policy management, and audit trails.

## 🚀 Features

### Core Security Features
- **Blockchain-based Access Control**: Immutable access policies stored on Ethereum blockchain
- **Multi-level Authentication**: JWT tokens, API keys, and blockchain signatures
- **Attribute-Based Access Control (ABAC)**: Dynamic policy evaluation based on user attributes, device properties, and environmental conditions
- **Time-based Access Policies**: Granular time-based access controls
- **Location-based Access**: Geographic access restrictions
- **Delegation Chains**: Hierarchical permission delegation
- **Real-time Monitoring**: Live system monitoring and alerting

### System Components
- **Smart Contracts**: Solidity contracts for device registry, policy management, access control, and audit logging
- **Backend API**: Node.js/Express.js RESTful API with comprehensive security
- **Frontend Dashboard**: React TypeScript dashboard with real-time updates
- **Device Simulator**: Python-based IoT device simulator
- **Edge Gateway**: MQTT-based edge computing gateway
- **Monitoring**: Real-time system monitoring and analytics

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   IoT Devices   │    │  Edge Gateway   │    │  Backend API    │
│                 │◄──►│                 │◄──►│                 │
│ • Smart Cameras │    │ • MQTT Broker   │    │ • Express.js    │
│ • Sensors       │    │ • Data Processing│    │ • MongoDB       │
│ • Actuators     │    │ • Local Caching │    │ • Redis         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend       │    │  Blockchain     │    │  Monitoring     │
│  Dashboard      │◄──►│  Network        │◄──►│  & Analytics   │
│                 │    │                 │    │                 │
│ • React/TS      │    │ • Ethereum      │    │ • Real-time     │
│ • Real-time UI  │    │ • Smart Contracts│   │ • Metrics       │
│ • Socket.IO     │    │ • Web3.js       │    │ • Alerts        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Technology Stack

### Blockchain Layer
- **Ethereum**: Smart contract platform
- **Solidity**: Smart contract language
- **Truffle Suite**: Development framework
- **Ganache**: Local blockchain network
- **Web3.js/Ethers.js**: Blockchain interaction

### Backend Services
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **MongoDB**: Document database
- **Redis**: Caching and message queue
- **MQTT**: IoT communication protocol
- **Socket.IO**: Real-time communication
- **JWT**: Authentication tokens
- **bcrypt**: Password hashing

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool
- **Tailwind CSS**: Styling
- **React Query**: Data fetching
- **Socket.IO Client**: Real-time updates
- **Recharts**: Data visualization

### DevOps & Monitoring
- **Docker**: Containerization
- **Winston**: Logging
- **Swagger**: API documentation
- **Jest**: Testing framework

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- MongoDB 5+
- Redis 6+
- Ganache (for local blockchain)

### Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd iot-access-control-blockchain
```

2. **Install dependencies**
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Install contract dependencies
cd ../contracts && npm install
```

3. **Set up environment variables**
```bash
# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

4. **Configure blockchain**
```bash
# Start Ganache (desktop app recommended)
# Or use Ganache CLI
npx ganache-cli

# Deploy smart contracts
cd contracts
npm run deploy:contracts
```

5. **Start the services**
```bash
# Start all services
npm run dev

# Or start individually:
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev

# Device Simulator
cd device-simulator && python main.py
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
# Server
PORT=8000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/iot_access_control

# Redis
REDIS_URL=redis://localhost:6379

# Blockchain
ETHEREUM_NETWORK=development
ETHEREUM_RPC_URL=http://localhost:8545
PRIVATE_KEY=your_private_key_here

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# MQTT
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## 🚀 Usage

### 1. Access the Dashboard
- Open http://localhost:3000
- Register a new account or login
- Navigate through the dashboard sections

### 2. Register IoT Devices
- Go to Devices section
- Add new devices with their specifications
- Configure device permissions and policies

### 3. Create Access Policies
- Navigate to Policies section
- Create ABAC, time-based, or location-based policies
- Assign policies to devices and users

### 4. Monitor Access Control
- Use Access Control section to manage access requests
- View real-time access logs and audit trails
- Monitor security incidents and alerts

### 5. System Monitoring
- Check Monitoring section for system metrics
- View performance analytics and health status
- Manage alerts and notifications

## 📊 API Documentation

The API documentation is available at:
- **Swagger UI**: http://localhost:8000/api-docs
- **Health Check**: http://localhost:8000/health

### Key API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token

#### Devices
- `GET /api/devices` - List all devices
- `POST /api/devices` - Register new device
- `GET /api/devices/:id` - Get device details
- `PUT /api/devices/:id` - Update device

#### Policies
- `GET /api/policies` - List all policies
- `POST /api/policies` - Create new policy
- `GET /api/policies/:id` - Get policy details
- `PUT /api/policies/:id` - Update policy

#### Access Control
- `POST /api/access/request` - Request access
- `POST /api/access/grant` - Grant access
- `POST /api/access/deny` - Deny access
- `POST /api/access/revoke` - Revoke access
- `POST /api/access/check` - Check access

#### Audit & Compliance
- `GET /api/audit/logs` - Get audit logs
- `POST /api/audit/reports/generate` - Generate compliance report
- `GET /api/audit/incidents` - Get security incidents

#### Monitoring
- `GET /api/monitoring/dashboard` - Get dashboard metrics
- `GET /api/monitoring/alerts` - Get system alerts
- `GET /api/monitoring/health` - System health check

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure stateless authentication
- **Role-based Access Control (RBAC)**: User role management
- **API Key Authentication**: Device-level authentication
- **Blockchain Signature Verification**: Cryptographic verification

### Access Control Models
- **Attribute-Based Access Control (ABAC)**: Dynamic policy evaluation
- **Time-based Access**: Temporal access restrictions
- **Location-based Access**: Geographic access controls
- **Delegation Chains**: Hierarchical permissions

### Security Monitoring
- **Real-time Alerts**: Immediate security incident notifications
- **Audit Trails**: Immutable blockchain audit logs
- **Compliance Reporting**: Automated compliance reports
- **Performance Monitoring**: System health and performance metrics

## 🧪 Testing

### Run Tests
```bash
# Backend tests
cd backend && npm test

# Contract tests
cd contracts && npm test

# Frontend tests
cd frontend && npm test

# Integration tests
npm run test:integration
```

### Test Coverage
```bash
# Generate coverage reports
npm run test:coverage
```

## 📈 Monitoring & Analytics

### Real-time Metrics
- Device status and health
- Access request statistics
- Security incident tracking
- System performance metrics
- Blockchain transaction monitoring

### Alert System
- Security incident alerts
- Performance degradation warnings
- System health notifications
- Policy violation alerts

## 🔧 Development

### Project Structure
```
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   └── utils/          # Utility functions
│   └── package.json
├── contracts/              # Smart contracts
│   ├── contracts/          # Solidity contracts
│   ├── migrations/         # Deployment scripts
│   └── test/              # Contract tests
├── frontend/              # React dashboard
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   └── utils/         # Utility functions
│   └── package.json
├── device-simulator/      # IoT device simulator
├── edge-gateway/         # MQTT edge gateway
├── deployment/           # Docker & Kubernetes configs
└── docs/                # Documentation
```

### Development Commands
```bash
# Start development servers
npm run dev

# Build for production
npm run build

# Deploy contracts
npm run deploy:contracts

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individually
docker build -t iot-backend ./backend
docker build -t iot-frontend ./frontend
```

### Production Deployment
1. Set up production environment variables
2. Configure production blockchain network
3. Set up monitoring and logging
4. Deploy smart contracts to mainnet
5. Configure SSL certificates
6. Set up backup and recovery procedures

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in `/docs`
- Review the API documentation at `/api-docs`

## 🔄 Roadmap

### Phase 1 (Current)
- ✅ Core smart contracts
- ✅ Basic backend API
- ✅ Frontend dashboard
- ✅ Device registration
- ✅ Policy management

### Phase 2 (Next)
- 🔄 Advanced policy types
- 🔄 Real-time device monitoring
- 🔄 Advanced analytics
- 🔄 Mobile application

### Phase 3 (Future)
- 🔄 AI-powered threat detection
- 🔄 Multi-chain support
- 🔄 Advanced delegation models
- 🔄 Enterprise features

---

**Built with ❤️ for secure IoT access control** 