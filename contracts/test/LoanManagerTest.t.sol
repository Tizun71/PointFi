// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseTest.sol";

contract LoanManagerTest is BaseTest {
    
    function testRequestLoan() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        
        vm.prank(borrower);
        uint256 loanId = loanManager.requestLoan(2 ether);
        
        assertEq(loanId, 1);
        
        (address borrowerAddr, uint256 amount, , bool approved, bool repaid, , ) = loanManager.loans(loanId);
        assertEq(borrowerAddr, borrower);
        assertEq(amount, 2 ether);
        assertEq(approved, false);
        assertEq(repaid, false);
    }
    
    function testCannotRequestLoanBelowMinimum() public {
        vm.prank(borrower);
        vm.expectRevert();
        loanManager.requestLoan(0.001 ether);
    }
    
    function testCannotRequestLoanAboveMaximum() public {
        vm.prank(borrower);
        vm.expectRevert();
        loanManager.requestLoan(150 ether);
    }
    
    function testCannotHaveMultiplePendingLoans() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        
        vm.startPrank(borrower);
        loanManager.requestLoan(1 ether);
        
        vm.expectRevert();
        loanManager.requestLoan(1 ether);
        vm.stopPrank();
    }
    
    function testOnlyOracleCanApproveLoan() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        
        vm.prank(borrower);
        uint256 loanId = loanManager.requestLoan(2 ether);
        
        vm.prank(attacker);
        vm.expectRevert();
        loanManager.approveLoan(loanId, 1);
    }
}
