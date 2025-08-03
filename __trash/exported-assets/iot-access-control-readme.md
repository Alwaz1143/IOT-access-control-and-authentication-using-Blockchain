# IoT Access Control & Authentication System
## Real-World Implementation with Blockchain Integration

This project implements a comprehensive, production-ready IoT access control and authentication system based on blockchain technology. It combines insights from the research papers "Opportunistic Access Control Scheme (OACS)" and "Dynamic Attribute Updates and Policy Hiding Bidirectional Attribute Access Control (DUPH-BAAC)" with practical real-world requirements.

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   IoT Devices   │◄──►│   Edge Gateway   │◄──►│  Blockchain     │
│  (Simulated/    │    │   (Access        │    │  Network        │
│   Physical)     │    │   Control)       │    │  (Smart         │
└─────────────────┘    └──────────────────┘    │  Contracts)     │
                                               └─────────────────┘
                                                        ▲
                                                        │
┌─────────────────┐    ┌──────────────────┐            │
│   Web Dashboard │◄──►│   Backend API    │◄───────────┘
│   Management    │    │   (Node.js/      │
│   Interface     │    │   Express)       │
└─────────────────┘    └──────────────────┘
```

## 🚀 Key Features

### Core Security Features
- **Blockchain-based Access Control**: Immutable access policies stored on blockchain
- **Smart Contract Automation**: Automated policy enforcement and audit trails
- **Multi-level Authentication**: Device certificates, API keys, and biometric support
- **Dynamic Policy Management**: Real-time policy updates without system downtime
- **Attribute-based Access Control (ABAC)**: Fine-grained permissions based on attributes
- **Time-based Access Policies**: Temporary access grants with automatic expiration

### Advanced Features  
- **Device Simulation Environment**: Built-in IoT device emulators for testing
- **Real-time Monitoring**: Live device status and access attempt monitoring
- **Audit Trail & Compliance**: Complete access logs for regulatory compliance
- **Multi-tenant Support**: Isolated environments for different organizations
- **API Gateway**: RESTful APIs for external system integration
- **Alert System**: Real-time notifications for security events

## 📁 Project Structure

```
iot-access-control-system/
├── contracts/                    # Smart Contracts
│   ├── IoTAccessControl.sol     # Main access control contract
│   ├── DeviceRegistry.sol       # Device registration contract
│   ├── PolicyManager.sol        # Dynamic policy management
│   └── AuditLogger.sol          # Audit trail contract
├── backend/                     # Backend Services
│   ├── api/                     # REST API endpoints
│   ├── services/                # Business logic services
│   ├── middleware/              # Authentication & validation
│   ├── models/                  # Data models
│   └── utils/                   # Utility functions
├── frontend/                    # Web Dashboard
│   ├── src/                     # React.js source code
│   └── public/                  # Static assets
├── device-simulator/            # IoT Device Simulators
│   ├── simulators/              # Different device types
│   ├── protocols/               # MQTT, CoAP, HTTP clients
│   └── scenarios/               # Test scenarios
├── edge-gateway/                # Edge Gateway Implementation
│   ├── auth/                    # Authentication service
│   ├── proxy/                   # API proxy
│   └── monitoring/              # Device monitoring
├── deployment/                  # Deployment configurations
│   ├── docker/                  # Docker containers
│   ├── k8s/                     # Kubernetes manifests
│   └── scripts/                 # Deployment scripts
├── tests/                       # Test suites
└── docs/                        # Documentation
```

## 🛠️ Technology Stack

### Blockchain Layer
- **Smart Contracts**: Solidity (Ethereum)
- **Development Framework**: Truffle Suite 
- **Testing**: Ganache CLI for local blockchain

### Backend Services
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (device data) + Redis (caching) 
- **Blockchain Interaction**: Web3.js / Ethers.js
- **Authentication**: JWT + OAuth 2.0
- **Message Queue**: Redis Bull for job processing

### Frontend Dashboard
- **Framework**: React.js 18+ with TypeScript
- **State Management**: Redux Toolkit
- **UI Library**: Material-UI (MUI)
- **Charts**: Chart.js / D3.js for monitoring
- **Real-time Updates**: Socket.io

### IoT Communication  
- **Protocols**: MQTT, CoAP, HTTP/HTTPS
- **Message Broker**: Eclipse Mosquitto / RabbitMQ
- **Device Simulation**: Custom simulators + MQTT.js
- **Security**: TLS/SSL encryption, X.509 certificates

### Deployment & DevOps
- **Containerization**: Docker & Docker Compose
- **Orchestration**: Kubernetes (optional)
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Docker & Docker Compose
- Git
- MongoDB (local or cloud)
- Ganache CLI or local Ethereum node

### Quick Start

1. **Clone the Repository**
```bash
git clone <repository-url>
cd iot-access-control-system
```

2. **Install Dependencies**
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies  
cd frontend && npm install && cd ..

# Install device simulator dependencies
cd device-simulator && npm install && cd ..
```

3. **Setup Environment**
```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env

# Edit configuration files with your settings
```

4. **Deploy Smart Contracts**
```bash
# Start local blockchain
ganache-cli -h 0.0.0.0 -p 8545 -m "your mnemonic here"

# Deploy contracts
npm run deploy:contracts
```

5. **Start Services**
```bash
# Start all services with Docker Compose
docker-compose up -d

# Or start services individually:
npm run start:backend    # Backend API
npm run start:frontend   # Web dashboard  
npm run start:simulator  # Device simulators
```

6. **Access the System**
- Web Dashboard: http://localhost:3000
- API Documentation: http://localhost:8000/api/docs
- Device Simulator UI: http://localhost:3001

## 🎯 Usage Examples

### Device Registration
```javascript
// Register a new IoT device
const deviceData = {
  uid: "sensor-001",
  type: "temperature_sensor", 
  location: "Building A - Floor 2",
  attributes: {
    manufacturer: "AcmeSensors",
    model: "TS-100",
    capabilities: ["temperature", "humidity"]
  }
};

const response = await fetch('/api/devices/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(deviceData)
});
```

### Access Policy Creation
```javascript
// Create an attribute-based access policy
const policy = {
  name: "Building Access Policy",
  rules: [
    {
      subject: { role: "security_guard", building: "A" },
      resource: { type: "door_lock", location: "Building A" },
      action: "unlock",
      conditions: {
        time_range: "06:00-18:00",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
      }
    }
  ]
};

await fetch('/api/policies', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(policy)
});
```

### Device Simulation
```javascript
// Start device simulation
const simulator = new IoTDeviceSimulator({
  deviceType: 'temperature_sensor',
  mqttBroker: 'mqtt://localhost:1883',
  publishInterval: 5000,
  dataGenerator: () => ({
    temperature: 20 + Math.random() * 10,
    humidity: 40 + Math.random() * 20,
    timestamp: new Date().toISOString()
  })
});

simulator.start();
```

## 🔐 Security Features

### Authentication Methods
1. **Device Certificates**: X.509 certificates for device identity
2. **API Key Authentication**: For service-to-service communication  
3. **JWT Tokens**: For user sessions with automatic refresh
4. **Blockchain Signatures**: Transaction signing for access requests

### Access Control Models
1. **Role-Based Access Control (RBAC)**: Traditional role-based permissions
2. **Attribute-Based Access Control (ABAC)**: Fine-grained attribute policies
3. **Time-Based Access**: Policies with temporal constraints
4. **Location-Based Access**: Geographic restriction support

### Audit & Compliance
- **Immutable Audit Logs**: All access attempts recorded on blockchain
- **Compliance Reports**: Automated GDPR, HIPAA compliance reporting
- **Real-time Alerts**: Security incident notifications
- **Forensic Analysis**: Detailed access pattern analysis

## 📊 Monitoring & Analytics

### Real-time Dashboards
- Device status and health monitoring
- Access request success/failure rates
- Policy enforcement metrics
- Security alert timeline

### Performance Metrics
- Transaction throughput monitoring
- API response time tracking
- Device connectivity status
- Blockchain network health

## 🧪 Testing & Simulation

### Device Simulators Included
1. **Smart Home Devices**: Lights, locks, thermostats, cameras
2. **Industrial Sensors**: Temperature, pressure, vibration, flow
3. **Healthcare Devices**: Patient monitors, medical equipment
4. **Smart City Infrastructure**: Traffic lights, parking meters, environmental sensors

### Test Scenarios
- **Penetration Testing**: Automated security testing scenarios
- **Load Testing**: High-volume device simulation
- **Failure Testing**: Network partition and device failure simulation
- **Policy Testing**: Access policy validation scenarios

## 🚀 Deployment Options

### Development Environment
- Local deployment with Docker Compose
- In-memory databases for quick testing
- Simulated IoT devices for development

### Production Environment  
- Kubernetes cluster deployment
- High-availability database setup
- Real device integration
- Load balancer and CDN integration

## 📚 API Documentation

### Device Management
- `POST /api/devices/register` - Register new device
- `GET /api/devices` - List all devices
- `PUT /api/devices/:id` - Update device information
- `DELETE /api/devices/:id` - Remove device

### Access Control
- `POST /api/policies` - Create access policy
- `GET /api/policies` - List policies
- `POST /api/access/request` - Request resource access
- `GET /api/access/logs` - Access audit logs

### Monitoring
- `GET /api/health` - System health status
- `GET /api/metrics` - System metrics
- `GET /api/alerts` - Active security alerts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Create GitHub issues for bugs and feature requests
- **Discussions**: Join GitHub Discussions for community support
- **Wiki**: Check the project wiki for additional resources

## 🌟 Acknowledgments

This implementation is inspired by and builds upon research from:
- "Opportunistic Access Control Scheme for enhancing IoT-enabled healthcare security using blockchain and machine learning" (Nature Scientific Reports)
- "A secure and scalable IoT access control framework with dynamic attribute updates and policy hiding" (Nature Scientific Reports)
- IoTSecurityBlockchain repository by rokibulroni