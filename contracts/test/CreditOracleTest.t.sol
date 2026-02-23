// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseTest.sol";

contract CreditOracleTest is BaseTest {
    
    function testCreditScoreApprovalPremiumTier() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        
        vm.prank(borrower);
        uint256 loanId = loanManager.requestLoan(2 ether);
        
        (, , , , , , bytes32 requestId) = loanManager.loans(loanId);
        
        uint256 creditScore = 750;
        bytes memory response = abi.encode(creditScore);
        
        mockRouter.fulfillRequest(
            address(creditOracle),
            requestId,
            response,
            new bytes(0)
        );
        
        (, , uint256 interestRate, bool approved, , , ) = loanManager.loans(loanId);
        assertTrue(approved);
        assertEq(interestRate, 5);
    }
    
    function testCreditScoreApprovalStandardTier() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        
        vm.prank(borrower);
        uint256 loanId = loanManager.requestLoan(2 ether);
        
        (, , , , , , bytes32 requestId) = loanManager.loans(loanId);
        
        uint256 creditScore = 680;
        bytes memory response = abi.encode(creditScore);
        
        mockRouter.fulfillRequest(
            address(creditOracle),
            requestId,
            response,
            new bytes(0)
        );
        
        (, , uint256 interestRate, bool approved, , , ) = loanManager.loans(loanId);
        assertTrue(approved);
        assertEq(interestRate, 10);
    }
    
    function testCreditScoreRejection() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        
        vm.prank(borrower);
        uint256 loanId = loanManager.requestLoan(2 ether);
        
        (, , , , , , bytes32 requestId) = loanManager.loans(loanId);
        
        uint256 creditScore = 600;
        bytes memory response = abi.encode(creditScore);
        
        vm.expectEmit(true, true, false, true);
        emit LoanRejected(loanId, borrower, 2 ether, "Credit score too low");
        
        mockRouter.fulfillRequest(
            address(creditOracle),
            requestId,
            response,
            new bytes(0)
        );
        
        (, , , bool approved, , , ) = loanManager.loans(loanId);
        assertFalse(approved);
    }
}
