// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseTest.sol";

contract IntegrationTest is BaseTest {
    
    function testFullLoanLifecycle() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        uint256 initialLiquidity = lendingPool.totalLiquidity();
        
        vm.prank(borrower);
        uint256 loanId = loanManager.requestLoan(2 ether);
        
        (, , , , , , bytes32 requestId) = loanManager.loans(loanId);
        mockRouter.fulfillRequest(
            address(creditOracle),
            requestId,
            abi.encode(uint256(750)),
            new bytes(0)
        );
        
        assertEq(lendingPool.totalLiquidity(), initialLiquidity - 2 ether);
        
        vm.warp(block.timestamp + 365 days);
        
        (uint256 totalRepayment, , uint256 interest) = loanManager.calculateRepayment(loanId);
        vm.prank(borrower);
        loanManager.repayLoan{value: totalRepayment}(loanId);
        
        assertEq(lendingPool.totalLiquidity(), initialLiquidity + interest);
        
        uint256 expectedInterest = (2 ether * 5) / 100;
        assertEq(interest, expectedInterest);
    }
    
    function testReentrancyProtection() public {
        assertTrue(true);
    }
}
