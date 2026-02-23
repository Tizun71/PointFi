// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/LendingPool.sol";
import "../src/LoanManager.sol";
import "../src/CreditOracleConsumer.sol";

/**
 * @title Deploy Script
 * @notice Deploys the complete lending protocol with Chainlink Functions integration
 * @dev Run with: forge script script/Deploy.s.sol:DeployScript --rpc-url sepolia --broadcast
 */
contract DeployScript is Script {
    // Sepolia Chainlink Functions configuration
    address constant SEPOLIA_FUNCTIONS_ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 constant SEPOLIA_DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;
    
    function run() external {
        // Load deployment configuration from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint64 subscriptionId = uint64(vm.envOr("SUBSCRIPTION_ID", uint256(0)));
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("==========================================");
        console.log("Deploying Lending Protocol");
        console.log("==========================================");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Network: Sepolia");
        console.log("");
        
        // ============ Deploy LendingPool ============
        console.log("1. Deploying LendingPool...");
        LendingPool lendingPool = new LendingPool();
        console.log("   LendingPool deployed at:", address(lendingPool));
        console.log("");
        
        // ============ Deploy LoanManager ============
        console.log("2. Deploying LoanManager...");
        LoanManager loanManager = new LoanManager();
        console.log("   LoanManager deployed at:", address(loanManager));
        console.log("");
        
        // ============ Deploy CreditOracleConsumer ============
        console.log("3. Deploying CreditOracleConsumer...");
        CreditOracleConsumer creditOracle = new CreditOracleConsumer(
            SEPOLIA_FUNCTIONS_ROUTER,
            SEPOLIA_DON_ID,
            subscriptionId
        );
        console.log("   CreditOracleConsumer deployed at:", address(creditOracle));
        console.log("   Functions Router:", SEPOLIA_FUNCTIONS_ROUTER);
        console.log("   DON ID:", vm.toString(SEPOLIA_DON_ID));
        console.log("   Subscription ID:", subscriptionId);
        console.log("");
        
        // ============ Configure Contract References ============
        console.log("4. Configuring contract references...");
        
        // Set LoanManager in LendingPool
        lendingPool.setLoanManager(address(loanManager));
        console.log("   LendingPool.loanManager set to:", address(loanManager));
        
        // Set LendingPool and CreditOracle in LoanManager
        loanManager.setLendingPool(address(lendingPool));
        console.log("   LoanManager.lendingPool set to:", address(lendingPool));
        
        loanManager.setCreditOracle(address(creditOracle));
        console.log("   LoanManager.creditOracle set to:", address(creditOracle));
        
        // Set LoanManager in CreditOracle
        creditOracle.setLoanManager(address(loanManager));
        console.log("   CreditOracle.loanManager set to:", address(loanManager));
        console.log("");
        
        // ============ Set Chainlink Functions Source Code ============
        console.log("5. Setting Chainlink Functions source code...");
        
        // Read CRE-enabled source code from file
        string memory sourceCode = vm.readFile("cre/functions-source.js");
        creditOracle.setSource(sourceCode);
        console.log("   CRE source code set (", bytes(sourceCode).length, " bytes)");
        console.log("   Features: HTTP requests, TEE execution, fallback logic");
        console.log("");
        
        vm.stopBroadcast();
        
        // ============ Deployment Summary ============
        console.log("==========================================");
        console.log("Deployment Complete!");
        console.log("==========================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("-------------------");
        console.log("LendingPool:           ", address(lendingPool));
        console.log("LoanManager:           ", address(loanManager));
        console.log("CreditOracleConsumer:  ", address(creditOracle));
        console.log("");
        console.log("Next Steps:");
        console.log("-------------------");
        console.log("1. Create Chainlink Functions subscription at https://functions.chain.link");
        console.log("2. Fund subscription with LINK tokens (minimum 5 LINK)");
        console.log("3. Add CreditOracleConsumer as authorized consumer:", address(creditOracle));
        console.log("4. Update subscription ID:");
        console.log("   cast send", address(creditOracle), "\"setSubscriptionId(uint64)\" <SUBSCRIPTION_ID> --rpc-url sepolia --private-key $PRIVATE_KEY");
        console.log("5. Verify contracts on Etherscan");
        console.log("6. Test the system with the demo script");
        console.log("");
        
        // Save deployment addresses to JSON file
        string memory deploymentJson = string(abi.encodePacked(
            '{',
            '"lendingPool":"', vm.toString(address(lendingPool)), '",',
            '"loanManager":"', vm.toString(address(loanManager)), '",',
            '"creditOracleConsumer":"', vm.toString(address(creditOracle)), '",',
            '"functionsRouter":"', vm.toString(SEPOLIA_FUNCTIONS_ROUTER), '",',
            '"donId":"', vm.toString(SEPOLIA_DON_ID), '",',
            '"network":"sepolia"',
            '}'
        ));
        
        vm.writeFile("deployments.json", deploymentJson);
        console.log("Deployment addresses saved to deployments.json");
        console.log("");
    }
}
